const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Giả lập Database chứa danh sách người dùng
let users = [
    {
        mssv: 'admin', 
        password: 'admin',
        name: 'Ban Tổ Chức UIT',
        role: 'admin' // Gắn mác quyền lực
    },
    {
        mssv: '22521234',
        password: 'password123',
        name: 'NGUYEN VAN A',
        preferences: ['dieu1', 'dieu3'],
        role: 'student' // Sinh viên bình thường
    }
];

// 1. API Đăng nhập
app.post('/api/login', (req, res) => {
    const { mssv, password } = req.body;

    const foundUser = users.find(u => u.mssv === mssv && u.password === password);

    if (foundUser) {
        // Đăng nhập đúng thì vào đây
        return res.status(200).json({ 
            success: true, 
            message: 'Đăng nhập thành công',
            user: {
                mssv: foundUser.mssv,
                name: foundUser.name,
                preferences: foundUser.preferences,
                role: foundUser.role || 'student'
            }
        });
    } else {
        // Đăng nhập sai thì rớt xuống đây (Nằm NGOÀI ngoặc nhọn của if nha)
        return res.status(401).json({ success: false, message: 'Sai MSSV hoặc mật khẩu!' });
    }
});

// 2. API Đăng ký + Nhận Bias
app.post('/api/register', (req, res) => {
    const { mssv, password, name, preferences } = req.body;

    // Check xem MSSV đã tồn tại chưa
    const isExist = users.find(u => u.mssv === mssv);
    if (isExist) {
        return res.status(400).json({ success: false, message: 'MSSV này đã được đăng ký!' });
    }

    // Tạo user mới và nhét vào "Database"
    const newUser = {
        mssv,
        password,
        name: name || `Sinh viên ${mssv}`,
        // Đây chính là chỗ chứa "bias" (sở thích/ưu tiên). 
        // VD: Sinh viên tick chọn hứng thú với AI, DevOps, Blockchain (học thuật) hay Mùa hè xanh (tình nguyện)
        preferences: preferences || [] 
    };

    users.push(newUser);

    console.log("Danh sách User hiện tại:", users); // In ra terminal để bạn dễ track

    return res.status(201).json({ 
        success: true, 
        message: 'Đăng ký và lưu sở thích thành công!',
        user: { mssv: newUser.mssv, preferences: newUser.preferences }
    });
});
// --- MOCK DATA HOẠT ĐỘNG ---
let mockEvents = [
    { id: 1, title: "Seminar: Tương lai của AI & Machine Learning", category: "ai_dev", points: 5, time: "20/03/2026", link: "https:Sample.com" },
    { id: 2, title: "Workshop: Triển khai dự án với Docker & AWS", category: "devops", points: 5, time: "22/03/2026", link: "https:Sample.com" },
    { id: 3, title: "Talkshow: Ứng dụng Blockchain trong thực tế", category: "blockchain", points: 4, time: "25/03/2026", link: "https:Sample.com" },
    { id: 4, title: "Giải đấu E-sports UIT: Genshin Impact & Roblox", category: "esports", points: 3, time: "26/03/2026", link: "https:Sample.com" },
    { id: 5, title: "Chiến dịch Mùa hè xanh 2026", category: "volunteer", points: 10, time: "01/06/2026", link: "https:Sample.com" },
    { id: 6, title: "Cuộc thi Nhiếp ảnh: Khoảnh khắc sinh viên", category: "photography", points: 4, time: "15/04/2026", link: "https:Sample.com" }
];
// --- API QUẢN LÝ SỰ KIỆN (CỦA ADMIN) ---
// Lấy tất cả sự kiện
app.get('/api/events', (req, res) => {
    res.status(200).json({ success: true, data: mockEvents });
});

// Admin Thêm sự kiện mới (Create)
app.post('/api/events', (req, res) => {
    const { title, category, points, time } = req.body;
    const newEvent = {
        id: Date.now(), // Tạo ID ngẫu nhiên
        title, category, 
        points: parseInt(points), 
        time
    };
    mockEvents.push(newEvent);
    res.status(201).json({ success: true, message: 'Đã thêm sự kiện!', data: newEvent });
});

// Admin Xóa sự kiện (Delete)
app.delete('/api/events/:id', (req, res) => {
    const id = parseInt(req.params.id);
    mockEvents = mockEvents.filter(event => event.id !== id);
    res.status(200).json({ success: true, message: 'Đã xóa sự kiện!' });
});


// --- API THUẬT TOÁN ĐỀ XUẤT ---
app.get('/api/events/recommend', (req, res) => {
    // 1. Lấy MSSV từ Frontend gửi lên qua URL
    const mssv = req.query.mssv; 
    const user = users.find(u => u.mssv === mssv);

    if (!user) {
        return res.status(404).json({ success: false, message: "Chưa đăng nhập hoặc không tìm thấy user!" });
    }

    const userBiases = user.preferences || []; // Mảng sở thích của user

    // 2. CHẠY THUẬT TOÁN PHÂN LOẠI
    // Lọc ra các sự kiện TRÙNG khớp với sở thích (Đề xuất)
    const recommendedEvents = mockEvents.filter(event => userBiases.includes(event.category));
    
    // Lọc ra các sự kiện KHÔNG TRÙNG (Để hiển thị phía dưới, không bỏ sót)
    const otherEvents = mockEvents.filter(event => !userBiases.includes(event.category));

    // 3. GỘP MẢNG (Xếp ưu tiên lên đầu)
    const finalList = [...recommendedEvents, ...otherEvents];

    // Trả kết quả về cho Frontend
    res.status(200).json({
        success: true,
        data: finalList
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Server Backend đang chạy tại http://localhost:${PORT}`);
});