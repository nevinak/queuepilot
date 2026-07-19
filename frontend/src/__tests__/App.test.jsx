/* eslint-env jest */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

describe('QueuePilot app shell', () => {
  it('renders the landing hero content', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByText(/Premium queue orchestration/i)).toBeInTheDocument();
  });
});
