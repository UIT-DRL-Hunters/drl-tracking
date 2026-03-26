const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// 1. KẾT NỐI MONGODB (LOCAL)
// ==========================================
// Chú ý: Ông phải cài MongoDB trên máy tính (hoặc dùng MongoDB Compass) rồi start nó lên nhé.
// Nếu dùng MongoDB Atlas (Cloud), thì thay cái link mongodb://... bằng link SRV của Atlas.
mongoose.connect('mongodb://127.0.0.1:27017/uit_drl_tracker')
    .then(() => console.log('✅ Đã kết nối thành công với MongoDB!'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// ==========================================
// 2. KHAI BÁO CẤU TRÚC DỮ LIỆU (SCHEMAS)
// ==========================================

// Bảng Sinh Viên (Users)
const userSchema = new mongoose.Schema({
    mssv: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, default: 'student' },
    preferences: { type: [String], default: [] },
    registeredEvents: { type: [Number], default: [] }
});
const User = mongoose.model('User', userSchema);

// Bảng Sự Kiện (Events)
const eventSchema = new mongoose.Schema({
    id: { type: Number, default: () => Date.now() }, // Dùng số để không vỡ Frontend cũ
    title: { type: String, required: true },
    category: { type: String, required: true },
    points: { type: Number, required: true },
    time: { type: String, required: true }
});
const Event = mongoose.model('Event', eventSchema);
// ==========================================
// TỰ ĐỘNG BƠM DỮ LIỆU MẪU (SEEDING)
// ==========================================
const seedDatabase = async () => {
    try {
        // 1. Bơm Sự kiện mẫu
        const eventCount = await Event.countDocuments();
        if (eventCount === 0) {
            console.log('⏳ Database đang trống sự kiện, tiến hành bơm dữ liệu...');
            const mockEvents = [
                { id: 1, title: "Seminar: Tương lai của AI & Machine Learning", category: "dieu1", points: 5, time: "20/03/2026" },
                { id: 2, title: "Workshop: Triển khai dự án với Docker & AWS", category: "dieu1", points: 5, time: "22/03/2026" },
                { id: 3, title: "Talkshow: Ứng dụng Blockchain trong thực tế", category: "dieu1", points: 4, time: "25/03/2026" },
                { id: 4, title: "Giải đấu E-sports UIT: Genshin Impact & Roblox", category: "dieu3", points: 3, time: "26/03/2026" },
                { id: 5, title: "Chiến dịch Mùa hè xanh 2026", category: "dieu4", points: 10, time: "01/06/2026" },
                { id: 6, title: "Cuộc thi Nhiếp ảnh: Khoảnh khắc sinh viên", category: "dieu2", points: 4, time: "15/04/2026" },
                { id: 7, title: "Lễ tuyên dương Sinh viên 5 Tốt cấp Trường", category: "dieu5", points: 10, time: "30/05/2026" }
            ];
            await Event.insertMany(mockEvents);
            console.log('✅ Đã bơm xong sự kiện mẫu!');
        }

        // 2. Kích hoạt tài khoản Admin (Đã tách riêng biệt ra ngoài)
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount === 0) {
            await User.create({
                mssv: 'admin',
                password: 'admin', 
                name: 'Quản trị viên Hệ thống',
                role: 'admin'
            });
            console.log('✅ Đã tạo tài khoản Admin (MSSV: admin - Pass: admin)!');
        }

    } catch (error) {
        console.error('❌ Lỗi khi bơm dữ liệu:', error);
    }
};

seedDatabase();

// ==========================================
// 3. CÁC API DÀNH CHO USER (AUTH)
// ==========================================

// Đăng nhập
app.post('/api/login', async (req, res) => {
    try {
        const { mssv, password } = req.body;
        // Tìm user trong Database
        const foundUser = await User.findOne({ mssv: mssv, password: password });

        if (foundUser) {
            return res.status(200).json({ 
                success: true, 
                message: 'Đăng nhập thành công',
                user: {
                    mssv: foundUser.mssv,
                    name: foundUser.name,
                    preferences: foundUser.preferences,
                    role: foundUser.role
                }
            });
        } else {
            return res.status(401).json({ success: false, message: 'Sai MSSV hoặc mật khẩu!' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi Server!' });
    }
});

// Đăng ký
app.post('/api/register', async (req, res) => {
    try {
        const { mssv, password, name, preferences } = req.body;

        // Check trùng MSSV
        const isExist = await User.findOne({ mssv: mssv });
        if (isExist) {
            return res.status(400).json({ success: false, message: 'MSSV này đã được đăng ký!' });
        }

        // Lưu vào MongoDB
        const newUser = new User({
            mssv,
            password,
            name: name || `Sinh viên ${mssv}`,
            preferences: preferences || [] 
        });
        await newUser.save();

        return res.status(201).json({ 
            success: true, 
            message: 'Đăng ký thành công!',
            user: { mssv: newUser.mssv }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi Server!' });
    }
});


// ==========================================
// 4. CÁC API QUẢN LÝ SỰ KIỆN (ADMIN & GỢI Ý)
// ==========================================

// Lấy tất cả sự kiện (Cho Admin & Tất cả)
app.get('/api/events', async (req, res) => {
    try {
        // Lấy tất cả trừ cái trường _id và __v của Mongo cho JSON nó sạch
        const events = await Event.find({}, '-_id -__v');
        res.status(200).json({ success: true, data: events });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi Server' });
    }
});

// Admin Thêm sự kiện
app.post('/api/events', async (req, res) => {
    try {
        const { title, category, points, time } = req.body;
        const newEvent = new Event({
            title, 
            category, 
            points: parseInt(points), 
            time
        });
        await newEvent.save();
        
        // Trả về data format giống cũ để Frontend không lỗi
        res.status(201).json({ 
            success: true, 
            message: 'Đã thêm sự kiện!', 
            data: { id: newEvent.id, title, category, points, time } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi Server' });
    }
});

// Admin Xóa sự kiện
app.delete('/api/events/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await Event.deleteOne({ id: id }); // Xóa dựa trên id số của mình
        res.status(200).json({ success: true, message: 'Đã xóa sự kiện!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi Server' });
    }
});

// API Đề xuất sự kiện theo Bias
app.get('/api/events/recommend', async (req, res) => {
    try {
        const mssv = req.query.mssv; 
        const user = await User.findOne({ mssv: mssv });

        if (!user) {
            return res.status(404).json({ success: false, message: "Không tìm thấy user!" });
        }

        const userBiases = user.preferences || []; 

        // Truy vấn MongoDB: Lấy những sự kiện có category NẰM TRONG mảng userBiases
        const recommendedEvents = await Event.find({ category: { $in: userBiases } }, '-_id -__v');
        
        // Lấy những sự kiện có category KHÔNG NẰM TRONG mảng userBiases
        const otherEvents = await Event.find({ category: { $nin: userBiases } }, '-_id -__v');

        const finalList = [...recommendedEvents, ...otherEvents];

        res.status(200).json({ success: true, data: finalList });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi Server' });
    }
});

// ==========================================
// 5. KHỞI CHẠY SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 Server Backend đang chạy tại http://localhost:${PORT}`);
});
// API: Sinh viên bấm xác nhận Đăng ký sự kiện
app.post('/api/events/register', async (req, res) => {
    try {
        const { mssv, eventId } = req.body;
        const user = await User.findOne({ mssv: mssv });
        
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy sinh viên!' });
        if (user.registeredEvents.includes(eventId)) return res.status(400).json({ success: false, message: 'Bạn đã đăng ký sự kiện này rồi!' });

        // Nhét ID sự kiện vào mảng và lưu lại
        user.registeredEvents.push(eventId);
        await user.save();
        
        res.status(200).json({ success: true, message: 'Đăng ký thành công!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi Server' });
    }
});

// API: Lấy danh sách các sự kiện mà sinh viên ĐÃ ĐĂNG KÝ (Dùng để tô xám nút khi F5)
app.get('/api/users/:mssv/registered', async (req, res) => {
    try {
        const user = await User.findOne({ mssv: req.params.mssv });
        if (!user) return res.status(404).json({ success: false, data: [] });
        res.status(200).json({ success: true, data: user.registeredEvents });
    } catch (error) {
        res.status(500).json({ success: false, data: [] });
    }
});