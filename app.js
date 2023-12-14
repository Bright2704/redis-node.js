const express = require('express');
const redis = require('redis');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// ตรวจสอบว่าคุณได้ตั้งค่า Redis ไว้ถูกต้อง ถ้ามีรหัสผ่านหรือการตั้งค่าอื่นๆ
// ปรับตัวแปร url ให้ตรงกับการตั้งค่าของคุณ
const client = redis.createClient({
  url: 'redis://119.59.127.106:6379' // URL ของ Redis server
});

// เชื่อมต่อกับ Redis
client.connect().then(() => {
  console.log('Connected to Redis');
}).catch((err) => {
  console.error('Redis connection error:', err);
});

app.use(bodyParser.json());

// Endpoint สำหรับสร้างงาน
// Endpoint สำหรับสร้างงานที่ให้ผู้ใช้กำหนด key และ value เอง
app.post('/tasks', async (req, res) => {
  try {
    const taskData = req.body; // สมมติว่า taskData มีลักษณะเป็น object ที่มี keys และ values ที่ต้องการ
    // ตัวอย่าง taskData:
    // {
    //   "name": "Buy groceries",
    //   "priority": "High",
    //   "dueDate": "2023-12-31"
    // }

    const taskId = await client.incr('task_id'); // สร้าง ID งานใหม่
    const taskKey = `task:${taskId}`; // สร้าง key สำหรับ Redis

    // แปลง object taskData เป็น array ที่สลับกันระหว่าง keys และ values
    const taskArray = [];
    for (const [key, value] of Object.entries(taskData)) {
      taskArray.push(key, value);
    }
    
    // บันทึกข้อมูลลงใน Redis
    await client.hSet(taskKey, taskArray);

    res.status(201).send({ message: 'Task created', id: taskId, data: taskData });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating task');
  }
});


// Endpoint สำหรับอ่านงานทั้งหมด
app.get('/tasks', async (req, res) => {
  try {
    const keys = await client.keys('task:*');
    const tasks = [];
    for (const key of keys) {
      const taskData = await client.hGetAll(key);
      tasks.push(taskData);
    }
    res.status(200).json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error fetching tasks');
  }
});

// Endpoint สำหรับอัปเดตงาน
app.put('/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const { task } = req.body;
    const exists = await client.exists(`task:${taskId}`);
    if (exists) {
      await client.hSet(`task:${taskId}`, 'task', task);
      res.status(200).send({ message: 'Task updated', id: taskId });
    } else {
      res.status(404).send('Task not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating task');
  }
});

// Endpoint สำหรับลบงาน
app.delete('/tasks/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const result = await client.del(`task:${taskId}`);
    if (result) {
      res.status(200).send({ message: 'Task deleted', id: taskId });
    } else {
      res.status(404).send('Task not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting task');
  }
});

// เริ่มเซิร์ฟเวอร์
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// ปิดการเชื่อมต่อกับ Redis เมื่อโปรแกรมถูกปิด
process.on('exit', () => {
  client.quit();
});
