from PIL import Image

Image.open('student.png').resize((128, 128)).save('student_resized.png')
Image.open('admin.png').resize((128, 128)).save('admin_resized.png')
