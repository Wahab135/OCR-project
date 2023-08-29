import express, { Express, Request, Response } from 'express';
import processImages from './ocrModule';
import expressAsyncHandler from 'express-async-handler';
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app: Express = express();
const port = 3000;
const INPUT_DIR = process.env.INPUT_DIR || "./input";
const OUTPUT_DIR = process.env.OUTPUT_DIR || "./output";
interface WorkerInput {
  inputDir: string;
  outputDir: string;
  files: string[];
}
const db = new PrismaClient();


app.get('/', (req: Request, res: Response)=>{
    res.send('Hello, this is Express + TypeScript');
});

app.get('/process', expressAsyncHandler(async (req: Request, res: Response) => {
    const workerInput: WorkerInput = {
        inputDir: INPUT_DIR,
        outputDir: OUTPUT_DIR,
        files: fs
            .readdirSync(INPUT_DIR)
            .filter((file) => [".jpg", ".jpeg", ".png"].includes(path.extname(file))),
    };
    try {
        await processImages(workerInput, INPUT_DIR, OUTPUT_DIR);
        res.status(200).json({ message: 'Images processed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'An error occurred' });
    }
}));

app.listen(port, ()=> {
console.log(`[Server]: I am running at https://localhost:${port}`);
});