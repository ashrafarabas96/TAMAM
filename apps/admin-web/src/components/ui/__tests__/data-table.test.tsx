import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { type Column, DataTable } from '../data-table';
import { ApiError } from '@/lib/api/errors';

interface Row {
  id: string;
  name: string;
  amount: number;
}

const rows: Row[] = [
  { id: '1', name: 'Ramallah', amount: 12 },
  { id: '2', name: 'Nablus', amount: 7 },
];

const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', cell: (r) => r.name },
  { key: 'amount', header: 'Amount', align: 'end', cell: (r) => r.amount },
];

describe('DataTable', () => {
  it('renders headers and rows', () => {
    renderWithProviders(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByText('Ramallah')).toBeInTheDocument();
    expect(screen.getByText('Nablus')).toBeInTheDocument();
    expect(screen.getByText('2 rows')).toBeInTheDocument();
  });

  it('shows the empty state with a custom title when there are no rows', () => {
    renderWithProviders(
      <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} emptyTitle="No zones yet" />,
    );
    expect(screen.getByText('No zones yet')).toBeInTheDocument();
    expect(screen.queryByText('Ramallah')).not.toBeInTheDocument();
  });

  it('renders skeleton placeholders while loading and no empty state', () => {
    renderWithProviders(<DataTable columns={columns} rows={[]} rowKey={(r) => r.id} isLoading />);
    expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
    expect(screen.getByTestId('data-table')).toBeInTheDocument();
  });

  it('renders an error state with the api error code and retries', async () => {
    const onRetry = vi.fn();
    const error = new ApiError(
      500,
      { code: 'INTERNAL_ERROR', message: 'boom', requestId: 'req-9' },
      'req-9',
    );
    renderWithProviders(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        error={error}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('req-9');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('loads the next keyset page on demand', async () => {
    const onLoadMore = vi.fn();
    renderWithProviders(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        hasMore
        onLoadMore={onLoadMore}
      />,
    );
    await userEvent.click(screen.getByTestId('load-more'));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('activates a row with the keyboard as well as the mouse', async () => {
    const onRowClick = vi.fn();
    renderWithProviders(
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />,
    );
    await userEvent.click(screen.getByText('Ramallah'));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });
});
