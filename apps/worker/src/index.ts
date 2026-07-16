import { Worker } from "bullmq";
export interface IngestionPayload { jobId:string; assetId:string; storageKey:string; mimeType:string }
export function startWorker(){const url=new URL(process.env.REDIS_URL??"redis://localhost:6379");const connection={host:url.hostname,port:Number(url.port||6379),username:url.username||undefined,password:url.password||undefined,maxRetriesPerRequest:null};return new Worker<IngestionPayload>("museum-ingestion",async job=>{await job.updateProgress(10);/* OCR、转录与模型只能由管理员注册的受控适配器执行。 */await job.updateProgress(100);return {jobId:job.data.jobId,status:"review"};},{connection});}
if(process.env.RUN_WORKER==="true")startWorker();
