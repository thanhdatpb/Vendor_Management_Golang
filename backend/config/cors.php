<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Đây là config CORS chuẩn cho LAN testing với React/Vite.
    | Cho phép FE trên máy khác gọi API Laravel.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],       // Cho phép tất cả method: GET, POST, PUT, DELETE...

    'allowed_origins' => ['*'],       // Cho phép tất cả origin (LAN + localhost)

    'allowed_headers' => ['*'],       // Cho phép tất cả header

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,   // Nếu dùng cookie/session

];