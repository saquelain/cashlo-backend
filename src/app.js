import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import calculatorRoutes, { adminCalculatorRouter } from './routes/calculator.routes.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, message: 'Cashlo API running...' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/calculators', calculatorRoutes);
app.use('/api/v1/admin/calculators', adminCalculatorRouter);

app.use(errorHandler);

export default app;