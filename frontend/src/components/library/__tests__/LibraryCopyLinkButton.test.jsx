import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LibraryCopyLinkButton, { COPY_FEEDBACK_MS } from '../LibraryCopyLinkButton';
import { copyLibraryFileLink } from '../../../utils/libraryFileLink';

vi.mock('../../../utils/libraryFileLink', () => ({
  copyLibraryFileLink: vi.fn(),
}));

const file = { id: 'file_1', filename: 'Baby Bodysuit.xlsx' };

beforeEach(() => {
  vi.useFakeTimers();
  copyLibraryFileLink.mockReset();
  copyLibraryFileLink.mockResolvedValue('https://example.test/library/file_1');
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('phản hồi copy ngay trên nút', () => {
  it('hiện “Copied” đúng 3 giây rồi trở lại “Copy link”', async () => {
    render(<LibraryCopyLinkButton file={file} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
      await Promise.resolve();
    });

    expect(copyLibraryFileLink).toHaveBeenCalledWith('file_1', 'Baby Bodysuit.xlsx');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(COPY_FEEDBACK_MS - 1); });
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();

    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('không tạo timer nếu cửa sổ đã đóng trước khi clipboard hoàn tất', async () => {
    let resolveCopy;
    copyLibraryFileLink.mockImplementation(() => new Promise((resolve) => {
      resolveCopy = resolve;
    }));
    const { unmount } = render(<LibraryCopyLinkButton file={file} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    unmount();
    await act(async () => {
      resolveCopy('https://example.test/library/file_1');
      await Promise.resolve();
    });

    expect(vi.getTimerCount()).toBe(0);
  });
});
