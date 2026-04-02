const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 1. KẾT NỐI MONGODB LOCAL
const localUrl = 'mongodb://127.0.0.1:27017/uit_drl_tracker';
mongoose.connect(localUrl, { family: 4 })
.then(() => {
    console.log('✅ [SUCCESS] Đã thông mạch MongoDB Local!');
    seedDatabase(); 
})
.catch(err => console.error('❌ Lỗi kết nối:', err.message));

// 2. SCHEMAS
const userSchema = new mongoose.Schema({
    mssv: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: 'student' },
    preferences: { type: [String], default: [] },
    registeredEvents: { type: [Number], default: [] }
});
const User = mongoose.model('User', userSchema);

const eventSchema = new mongoose.Schema({
    id: { type: Number, default: () => Date.now() },
    title: { type: String, required: true },
    category: { type: String, required: true },
    points: { type: Number, required: true },
    time: { type: String, required: true }
});
const Event = mongoose.model('Event', eventSchema);

// 3. SEEDING (Dữ liệu mẫu)
const seedDatabase = async () => {
    try {
        const eventCount = await Event.countDocuments();
        if (eventCount === 0) {
            const mockEvents = [
                { id: 1, title: "Seminar: AI & Data Science tại UIT", category: "dieu1", points: 5, time: "20/03/2026" },
                { id: 2, title: "Workshop: C++ Nâng cao", category: "dieu1", points: 5, time: "22/03/2026" },
                { id: 4, title: "Giải đấu E-sports: Liên Quân UIT", category: "dieu3", points: 3, time: "26/03/2026" },
                { id: 5, title: "Ngày hội hiến máu nhân đạo", category: "dieu4", points: 10, time: "01/06/2026" }
            ];
            await Event.insertMany(mockEvents);
        }
        if (await User.countDocuments({ role: 'admin' }) === 0) {
            await User.create({ mssv: 'admin', password: 'admin', name: 'Quản trị viên', role: 'admin' });
        }
    } catch (e) { console.log(e); }
};

// 4. API HỆ THỐNG
app.post('/api/login', async (req, res) => {
    const { mssv, password } = req.body;
    const user = await User.findOne({ mssv, password });
    if (user) res.json({ success: true, user });
    else res.status(401).json({ success: false, message: 'Sai tài khoản!' });
});

app.post('/api/register', async (req, res) => {
    const { mssv, password, name, preferences } = req.body;
    if (await User.findOne({ mssv })) return res.status(400).json({ success: false, message: 'MSSV đã tồn tại!' });
    await new User({ mssv, password, name, preferences }).save();
    res.json({ success: true });
});

app.get('/api/events', async (req, res) => {
    const events = await Event.find({}, '-__v');
    res.json({ success: true, data: events });
});

// API ADMIN: THÊM & XÓA (Để file admin.html không bị lỗi)
app.post('/api/events', async (req, res) => {
    const newEv = new Event(req.body);
    await newEv.save();
    res.json({ success: true });
});
app.delete('/api/events/:id', async (req, res) => {
    await Event.deleteOne({ id: req.params.id });
    res.json({ success: true });
});

// API GỢI Ý (Để nút "✨ Dành cho bạn" ở index.html hoạt động)
app.get('/api/events/recommend', async (req, res) => {
    const user = await User.findOne({ mssv: req.query.mssv });
    if (!user) return res.json({ success: false });
    const recommended = await Event.find({ category: { $in: user.preferences } });
    const others = await Event.find({ category: { $nin: user.preferences } });
    res.json({ success: true, data: [...recommended, ...others] });
});

app.post('/api/events/register', async (req, res) => {
    const { mssv, eventId } = req.body;
    const user = await User.findOne({ mssv });
    if (user && !user.registeredEvents.includes(eventId)) {
        user.registeredEvents.push(eventId);
        await user.save();
    }
    res.json({ success: true });
});

app.get('/api/users/:mssv/registered', async (req, res) => {
    const user = await User.findOne({ mssv: req.params.mssv });
    res.json({ success: true, data: user ? user.registeredEvents : [] });
});

app.listen(PORT, () => console.log(`🚀 Server chạy tại http://127.0.0.1:${PORT}`));