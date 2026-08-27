<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Media Disk (ảnh/video Product, Vendor, Vendor Library)
    |--------------------------------------------------------------------------
    |
    | Mặc định 'public' = lưu trên đĩa server như trước. Đổi thành 's3' để đẩy
    | media lên object storage (Cloudflare R2 / AWS S3) — khi đó đổi/chuyển
    | server không làm mất ảnh, vì file không còn nằm trên đĩa máy chủ.
    |
    | Đổi giá trị này CHỈ ảnh hưởng file upload MỚI. Muốn chuyển dữ liệu cũ,
    | chạy: php artisan app:migrate-media-to-object-storage
    |
    */

    'media' => env('MEDIA_DISK', 'public'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => rtrim(env('APP_URL', 'http://localhost'), '/').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),

            // BẮT BUỘC true: với throw=false, khi credential/endpoint R2 sai thì
            // lệnh upload thất bại ÂM THẦM — code vẫn ghi URL vào DB nhưng file
            // không hề tồn tại trên R2, tạo ra ảnh chết mà không có log nào.
            // Thà trả lỗi 500 để biết ngay còn hơn mất dữ liệu trong im lặng.
            'throw' => true,
            'report' => true,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
