import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { apiRoutes } from './routes/index.js';
import { ApiError,errorHandler } from './middleware/errors.js';

//Sets up Express, middleware, security checks, and API routes
export function createApp(config){
  const app=express();app.disable('x-powered-by');
  
  app.set('trust proxy', config.trustProxyHops ?? 1);
  const allowedOrigins = new Set(config.clients);
  const originAllowed = origin => !origin || allowedOrigins.has(origin);
  app.use(helmet());
  app.use((req,res,next)=>{res.set('Cache-Control','no-store');if(!originAllowed(req.get('Origin')))return next(new ApiError(403,'Origin is not allowed.'));next();});
  app.use(cors({origin(origin,callback){callback(null,originAllowed(origin));},credentials:true,methods:['GET','POST','PATCH','OPTIONS'],allowedHeaders:['Content-Type','X-CSRF-Token']}));
  app.use(rateLimit({windowMs:60000,limit:300,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many requests. Please slow down.'}}));
  app.use(express.json({limit:'2mb',strict:true}));app.use(cookieParser());
  app.get('/api/health',(req,res)=>{const connected=mongoose.connection.readyState===1;res.status(connected?200:503).json({status:connected?'ok':'database unavailable'});});
  app.use('/api',apiRoutes(config));
  app.use((req,res,next)=>next(new ApiError(404,'Endpoint not found.')));app.use(errorHandler);return app;
}
