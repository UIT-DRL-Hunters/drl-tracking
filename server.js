const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Thư viện băm mật khẩu
const jwt = require('jsonwebtoken'); // Thư viện tạo thẻ từ (Token)
const rateLimit = require('express-rate-limit'); // Thư viện chống spam/DoS

const app = express();
const PORT = 3000;
const SECRET_KEY = "UIT_Bao_Mat_Tuyet_Doi_2026"; // Chìa khóa mã hóa JWT

// --- 1. MIDDLEWARE BẢO MẬT ---
// Giới hạn số lần đăng nhập (Chống Brute Force)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 phút
    max: 5, // Tối đa 5 lần thử
    message: { success: false, message: "Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút!" }
});

app.use(cors());
app.use(express.json());

// Trạm kiểm soát thẻ từ (Token)
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ success: false, message: "Thiếu token xác thực!" });
    
    const token = authHeader.split(" ")[1]; // Cắt lấy phần sau chữ "Bearer "
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ success: false, message: "Token hết hạn hoặc không hợp lệ!" });
        req.user = decoded; // Lưu thông tin giải mã vào request để dùng sau
        next();
    });
};

// Trạm kiểm soát quyền Admin
const verifyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: "Không đủ thẩm quyền!" });
    next();
};

// --- 2. KẾT NỐI MONGODB LOCAL ---
const localUrl = 'mongodb://127.0.0.1:27017/uit_drl_tracker';
mongoose.connect(localUrl, { family: 4 })
.then(() => {
    console.log('✅ [SUCCESS] Đã thông mạch MongoDB Local!');
    seedDatabase(); 
})
.catch(err => console.error('❌ Lỗi kết nối:', err.message));

// --- 3. SCHEMAS ---
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

// --- 4. SEEDING (Dữ liệu mẫu) ---
const seedDatabase = async () => {
    try {
        const eventCount = await Event.countDocuments();
        if (eventCount === 0) {
            console.log('⏳ Local DB trống, đang đọc từ events.json để bơm dữ liệu...');
            const eventsData = require('./events.json'); 
            await Event.insertMany(eventsData);
            console.log(`✅ Đã bơm thành công ${eventsData.length} sự kiện vào Database!`);
        }
    } catch (err) {
        console.error('❌ Lỗi khi bơm dữ liệu:', err);
    }
};

// --- 5. API HỆ THỐNG ---

// Đăng nhập an toàn (Chống NoSQL Injection & Rò rỉ mật khẩu)
app.post('/api/login', loginLimiter, async (req, res) => {
    const { mssv, password } = req.body;
    
    if (typeof mssv !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ!' });
    }

    const user = await User.findOne({ mssv });
    if (!user) return res.status(401).json({ success: false, message: 'Sai tài khoản!' });

 // ...
    const isMatch = await bcrypt.compare(password, user.password);
    
    // --- CƠ CHẾ NÂNG CẤP MẬT KHẨU TỰ ĐỘNG ---
    if (!isMatch && password === user.password) {
        // Nếu user nhập đúng pass cũ (chưa mã hóa), ta băm nó và lưu đè lên DB luôn
        user.password = await bcrypt.hash(password, 10);
        await user.save();
    } else if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Sai mật khẩu!' });
    }
    // ...

    const token = jwt.sign({ id: user._id, mssv: user.mssv, role: user.role }, SECRET_KEY, { expiresIn: '2h' });
    
    res.json({ 
        success: true, 
        token, 
        user: { mssv: user.mssv, name: user.name, role: user.role } 
    });
});

// Đăng ký an toàn (Mã hóa mật khẩu)
app.post('/api/register', async (req, res) => {
    const { mssv, password, name, preferences } = req.body;
    if (await User.findOne({ mssv })) return res.status(400).json({ success: false, message: 'MSSV đã tồn tại!' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    await new User({ mssv, password: hashedPassword, name, preferences }).save();
    res.json({ success: true });
});

// Lấy danh sách sự kiện (Ai cũng xem được)
app.get('/api/events', async (req, res) => {
    const events = await Event.find({}, '-__v');
    res.json({ success: true, data: events });
});

// Admin Tạo sự kiện (Yêu cầu Token + Quyền Admin + Chống XSS)
app.post('/api/events', verifyToken, verifyAdmin, async (req, res) => {
    let { title, category, points, time } = req.body;
    
    if (!title || !category || !points || !time) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin sự kiện!" });
    }

    title = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const newEv = new Event({
    id: Date.now(), // Trả về số mili-giây tính từ năm 1970 tới ngay lúc bấm nút
    title, category, points, time
});
    await newEv.save();
    res.json({ success: true });
});

// Admin Xóa sự kiện (Yêu cầu Token + Quyền Admin)
app.delete('/api/events/:id', verifyToken, verifyAdmin, async (req, res) => {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) return res.status(400).json({ success: false, message: "ID không hợp lệ!" });
    
    await Event.deleteOne({ id: eventId });
    res.json({ success: true });
});

// Lấy đề xuất sự kiện
app.get('/api/events/recommend', async (req, res) => {
    const user = await User.findOne({ mssv: req.query.mssv });
    if (!user) return res.json({ success: false });
    const recommended = await Event.find({ category: { $in: user.preferences } });
    const others = await Event.find({ category: { $nin: user.preferences } });
    res.json({ success: true, data: [...recommended, ...others] });
});

// Sinh viên đăng ký tham gia sự kiện (Yêu cầu Token xác thực)
app.post('/api/events/register', verifyToken, async (req, res) => {
    const { mssv, eventId } = req.body;
    
    // Đảm bảo chỉ đăng ký cho chính mình bằng Token, chống gian lận lấy MSSV người khác
    if (req.user.mssv !== mssv) {
         return res.status(403).json({ success: false, message: "Không thể đăng ký dùm người khác!" });
    }

    const user = await User.findOne({ mssv });
    if (user && !user.registeredEvents.includes(eventId)) {
        user.registeredEvents.push(eventId);
        await user.save();
    }
    res.json({ success: true });
});

// Lấy danh sách sự kiện đã đăng ký
app.get('/api/users/:mssv/registered', async (req, res) => {
    const user = await User.findOne({ mssv: req.params.mssv });
    res.json({ success: true, data: user ? user.registeredEvents : [] });
});

app.listen(PORT, () => console.log(`🚀 Server chạy tại http://127.0.0.1:${PORT}`));