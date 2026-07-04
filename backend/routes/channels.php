<?php

use Illuminate\Support\Facades\Broadcast;

// Kênh public: mọi user đã đăng nhập đều nghe được (không cần xác thực riêng).
// Payload broadcast ra không chứa dữ liệu nhạy cảm cho role không liên quan;
// mỗi component tự lọc theo project/role khi nhận event.
