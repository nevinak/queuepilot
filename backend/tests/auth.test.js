const request = require('supertest');
const express = require('express');
const authRoutes = require('../routes/authRoutes');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth routes', () => {
  it('returns validation error for invalid registration payload', async () => {
    const response = await request(app).post('/api/auth/register').send({});
    expect(response.status).toBe(400);
  });

  it('returns validation error for invalid login payload', async () => {
    const response = await request(app).post('/api/auth/login').send({});
    expect(response.status).toBe(400);
  });
});
