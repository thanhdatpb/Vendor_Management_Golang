<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Vết gửi mail cho mỗi thông báo — cách duy nhất trả lời "sao anh ấy không
 * nhận được mail" mà không phải mò log. Vòng giá trị của `email_status`:
 * queued (job đã nhận, đang xử lý) → sent | failed | skipped. NULL nghĩa là
 * loại thông báo này không nằm trong danh sách gửi mail (news/feedback/pending
 * — xem config/notification_mail.php) nên chưa từng được job xử lý.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (!Schema::hasColumn('notifications', 'email_status')) {
                $table->string('email_status', 16)->nullable()->after('data')->index();
            }
            if (!Schema::hasColumn('notifications', 'email_sent_at')) {
                $table->timestamp('email_sent_at')->nullable()->after('email_status');
            }
            if (!Schema::hasColumn('notifications', 'email_error')) {
                $table->text('email_error')->nullable()->after('email_sent_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            if (Schema::hasColumn('notifications', 'email_status')) {
                $table->dropColumn(['email_status', 'email_sent_at', 'email_error']);
            }
        });
    }
};
