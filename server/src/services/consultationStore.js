const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const ensureDirectory = async (filePath) => {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true });
};

const readJSON = async (filePath) => {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const writeJSON = async (filePath, data) => {
  await ensureDirectory(filePath);
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
};

class ConsultationStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async list() {
    return readJSON(this.filePath);
  }

  async add(payload) {
    const current = await this.list();
    const record = {
      id: payload.id || randomUUID(),
      createdAt: new Date().toISOString(),
      ...payload,
    };
    current.unshift(record);
    await writeJSON(this.filePath, current);
    return record;
  }
}

module.exports = {
  ConsultationStore,
};
