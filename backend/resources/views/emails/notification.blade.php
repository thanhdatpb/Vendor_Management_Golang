<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $title }}</title>
</head>
{{-- Bố cục bằng table + CSS inline: Gmail và nhiều client cắt bỏ thẻ <style>,
     nên mọi màu/khoảng cách phải khai trực tiếp trên từng thẻ. --}}
<body style="margin:0;padding:0;background-color:#FFF8EE;font-family:Arial,Helvetica,sans-serif;">

    {{-- Preheader ẩn: client lấy 1-2 câu đầu làm dòng xem trước thay vì lấy đại
         chữ trong header nếu không có dòng này. --}}
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
        {{ Illuminate\Support\Str::limit(strip_tags($body), 90) }}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFF8EE;padding:24px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border:1px solid #F0E4CC;border-radius:12px;overflow:hidden;">

                    <tr>
                        <td style="background-color:#F5A623;color:#3A2708;padding:11px 24px;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;font-family:'Courier New',monospace;">
                            VENDORHUB &middot; {{ mb_strtoupper($label) }}
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:24px 28px 8px 28px;">
                            <h1 style="margin:0;font-size:20px;line-height:1.35;color:#2A2118;font-family:Georgia,'Times New Roman',serif;">
                                {{ $icon }} {{ $title }}
                            </h1>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:8px 28px 4px 28px;">
                            <p style="margin:0;font-size:15px;line-height:1.6;color:#5C4E3C;">
                                {!! nl2br(e($body)) !!}
                            </p>
                        </td>
                    </tr>

                    @if (!empty($meta))
                    <tr>
                        <td style="padding:16px 28px 4px 28px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #F0E4CC;">
                                @foreach ($meta as $metaLabel => $metaValue)
                                <tr>
                                    <td style="padding:6px 0;font-size:13px;color:#8B7960;width:120px;border-bottom:1px solid #F7F1E4;">{{ $metaLabel }}</td>
                                    <td style="padding:6px 0;font-size:14px;color:#2A2118;border-bottom:1px solid #F7F1E4;">{{ $metaValue }}</td>
                                </tr>
                                @endforeach
                            </table>
                        </td>
                    </tr>
                    @endif

                    <tr>
                        <td style="padding:24px 28px 8px 28px;">
                            <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="background-color:#F5A623;border-radius:8px;">
                                        <a href="{{ $buttonUrl }}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:bold;color:#3A2708;text-decoration:none;">
                                            {{ $buttonLabel }}
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:20px 28px 24px 28px;">
                            <p style="margin:0;font-size:12px;color:#8B7960;">
                                HappyC-VendorHub &middot; vendorhub.viehana.com
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>
