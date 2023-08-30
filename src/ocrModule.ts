import { PrismaClient } from "@prisma/client";
import express, { Express, Request, Response } from 'express';
import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import Tesseract, { createWorker } from "tesseract.js";
import { log } from "console";

interface WorkerInput {
  inputDir: string;
  outputDir: string;
  files: string[];
}

dotenv.config();

const db = new PrismaClient();
const processImages = async (req: Request, res: Response, workerInput: WorkerInput, INPUT_DIR: string, OUTPUT_DIR: string) => {
    let logs: any = [];

    const worker = await createWorker({
        langPath: path.join(__dirname, "..", "tesseract-data"),
    })
    
        await worker.loadLanguage("eng");
        await worker.initialize("eng");

        let processedCount = 0;

        for (const file of workerInput.files) {
            const filePath = path.join(workerInput.inputDir, file);

            try {
                const fileContents = fs.readFileSync(filePath);
                const fileHash = crypto.createHash("sha256").update(fileContents).digest("hex");

                const fileExists = await db.data.findUnique({
                    where: { fileHash },
                });

                if (fileExists) {
                    logs.push(`${file} has already been scanned`);
                    continue;
                }

                const {
                    data: { text },
                } = await worker.recognize(filePath);

                const matchedList = text.match(/\d{5}-?\d{7}-?\d{1}/g)?.map((data) => data.replace(/[- ]/g, ""));

                if (!matchedList || matchedList.length === 0) {
                    logs.push(`${file} does not contain valid data`);

                    return;
                }

                const { birthtime, mtime } = fs.statSync(filePath);
                const createdDate = new Date(birthtime);
                const modifiedDate = new Date(mtime);

                for (const extractedData of matchedList) {
                    await db.data.upsert({
                        where: { fileHash },
                        update: { extractedData, createdDate, modifiedDate },
                        create: {
                            fileHash,
                            fileName: file,
                            filePath: workerInput.inputDir,
                            extractedData,
                            createdDate,
                            modifiedDate,
                        },
                    });

                    logs.push(`Inserted data from ${file}: ${matchedList}`)


                }
            } catch (err) {
                logs.push(`Error processing file ${file}: ${err}`)

            }
            processedCount++;

            
            logs.push(
                `Processed ${processedCount} files of Total ${workerInput.files.length}`
            );

        }

       
        logs.push(
            ` Processed ${workerInput.files.length} files`
        );

        await worker.terminate();
        await db.$disconnect();
        return logs;

    
};

export default processImages