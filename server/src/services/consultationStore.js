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
      status: payload.status || 'new',
      internalNote: payload.internalNote || '',
      assignedTo: payload.assignedTo || '',
      followUpAt: payload.followUpAt || '',
      updatedAt: payload.updatedAt || '',
      updatedBy: payload.updatedBy || '',
      ...payload,
    };
    current.unshift(record);
    await writeJSON(this.filePath, current);
    return record;
  }

  async updateById(id, patch) {
    const current = await this.list();
    const next = current.map((item) =>
      String(item?.id || '') === String(id || '')
        ? {
            ...item,
            ...patch,
            id: item.id,
            createdAt: item.createdAt,
          }
        : item
    );
    await writeJSON(this.filePath, next);
    return next.find((item) => String(item?.id || '') === String(id || '')) || null;
  }
}

module.exports = {
  ConsultationStore,
};
