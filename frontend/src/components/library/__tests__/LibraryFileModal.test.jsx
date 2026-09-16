// ════════════════════════════════════════════════════════
//  Cửa sổ một file thư viện — hành vi đóng/mở
//
//  Đây là chỗ dễ làm hỏng trải nghiệm nhất: đóng nhầm lúc đang sửa dở, Esc
//  đóng cả 2 lớp cùng lúc, hay nền vẫn cuộn được dưới cửa sổ. Mỗi ca dưới đây
//  là một trong những lỗi đó.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryFileModal from '../LibraryFileModal';

const onClose = vi.fn();

beforeEach(() => { onClose.mockReset(); });

const open = (props = {}) => render(
  <LibraryFileModal title="Baby Bodysuit" onClose={onClose} {...props}>
    <div data-testid="noi-dung">Nội dung file</div>
  </LibraryFileModal>
);

describe('ba cách đóng', () => {
  it('nút ✕', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng cửa sổ file' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('phím Esc', async () => {
    open();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('bấm ra vùng nền mờ', async () => {
    const { container } = open();
    await userEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('bấm vào trong cửa sổ thì KHÔNG đóng', async () => {
    open();
    await userEvent.click(screen.getByTestId('noi-dung'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('đang sửa dở', () => {
  const openWithInput = () => render(
    <LibraryFileModal title="Baby Bodysuit" onClose={onClose} guardWhileEditing>
      <input aria-label="Giá vốn" defaultValue="8.2" />
    </LibraryFileModal>
  );

  it('bấm ra nền không đóng mà hiện nhắc — bấm nhầm ra ngoài là chuyện hằng ngày', async () => {
    const { container } = openWithInput();

    await userEvent.click(container.firstChild);

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Đang sửa dở');
  });

  it('Esc cũng không đóng khi đang có ô nhập mở', async () => {
    openWithInput();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('nút ✕ vẫn đóng — đó là ý muốn tường minh của người dùng', async () => {
    openWithInput();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng cửa sổ file' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cửa sổ chỉ-xem thì ô tìm kiếm không bị tính là đang sửa', async () => {
    const { container } = render(
      <LibraryFileModal title="Baby Bodysuit" onClose={onClose}>
        <input aria-label="Tìm" data-modal-safe="true" />
      </LibraryFileModal>
    );

    await userEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('nhiều lớp chồng nhau', () => {
  it('đang mở ảnh phóng to thì Esc để lớp ảnh tự xử lý, không đóng cả cửa sổ', async () => {
    open();

    // Lightbox đánh dấu mình bằng [data-esc-layer] khi đang mở.
    const lightbox = document.createElement('div');
    lightbox.setAttribute('data-esc-layer', 'lightbox');
    document.body.appendChild(lightbox);

    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();

    lightbox.remove();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('nền phía sau', () => {
  it('cửa sổ tận dụng chiều ngang và cách hai lề màn hình 1,5 cm', () => {
    const { container } = open();
    const scrim = container.firstChild;
    const dialog = screen.getByRole('dialog', { name: 'Baby Bodysuit' });

    expect(scrim.style.padding).toBe('16px 1.5cm');
    expect(dialog).toHaveStyle({ width: '100%' });
  });

  it('khoá cuộn khi mở và trả lại đúng giá trị cũ khi đóng', () => {
    document.body.style.overflow = 'auto';

    const { unmount } = open();
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('auto');
  });
});

describe('tiêu điểm và trình đọc màn hình', () => {
  it('là dialog có nhãn, và tiêu điểm vào cửa sổ ngay khi mở', () => {
    open();
    const dialog = screen.getByRole('dialog', { name: 'Baby Bodysuit' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.activeElement).toBe(dialog);
  });

  it('trả tiêu điểm về chỗ cũ khi đóng', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = open();
    unmount();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
