#!/usr/bin/env node
import {parseArgs} from "node:util"
import {randomUUID} from "node:crypto"
import {readFile,writeFile} from "node:fs/promises"
import {setTimeout as delay} from "node:timers/promises"

const help = `nore — run an onchain agent evaluation

Usage
  nore run --suite <slug-or-id> [--agent <slug-or-id>] [options]
  nore help
  nore --version

Examples
  nore run --suite wallet-safety
  nore run --suite wallet-safety --version 2 --json
  nore run --agent my-agent --suite wallet-safety --output report.json

Options
  --url <origin>          Nore origin (default: NORE_URL)
  --key-file <path>       Read a key from a file or "-" for stdin
  --version <number>     Pin a published suite version
  --gate strict|critical Strict fails on any case failure. Critical gates critical findings.
  --timeout <seconds>    Maximum polling time (default: 240)
  --idempotency-key <key> Reuse a submission key across CI retries
  --json                 Write the result document to stdout
  -o, --output <path>    Save JSON evidence ("-" writes to stdout)
  -q, --quiet            Suppress progress messages
  -h, --help             Show this help

Use NORE_API_KEY or --key-file for authentication.
Exit codes: 0 passed, 1 assertion gate failed, 2 usage, 3 unsupported/partial,
            4 infrastructure/timeout/cancelled, 5 API or filesystem error.
`
const terminal = new Set(["PASSED","FAILED","PARTIAL","SKIPPED","TIMED_OUT","CANCELLED","INFRA_ERROR"])
const usage = message=>{throw Object.assign(new Error(message),{exit:2})}
export function exitFor(run,gate="strict"){
  if(run.status==="PASSED")return 0
  if(run.status==="PARTIAL")return run.summary?.infra ? 4 : 3
  if(run.status==="SKIPPED")return 3
  if(run.status==="FAILED")return gate==="critical"&&run.summary?.critical===0&&run.summary?.skip===0&&run.summary?.infra===0?0:1
  return 4
}
function number(value,min,max,label){
  if(!/^\d+$/.test(value)||Number(value)<min||Number(value)>max)usage(`${label} must be an integer from ${min} to ${max}.`)
  return Number(value)
}
export async function main(argv){
  if(!argv.length||argv[0]==="help"||argv.includes("--help")||argv.includes("-h")){process.stdout.write(help);return 0}
  if(argv.length===1&&argv[0]==="--version"){console.log("0.1.0");return 0}
  if(argv[0]!=="run")usage("Expected the run subcommand.")
  let args
  try{args=parseArgs({args:argv.slice(1),options:{
    suite:{type:"string"},agent:{type:"string"},version:{type:"string"},url:{type:"string"},
    "key-file":{type:"string"},gate:{type:"string",default:"strict"},timeout:{type:"string",default:"240"},
    "idempotency-key":{type:"string"},json:{type:"boolean"},output:{type:"string",short:"o"},quiet:{type:"boolean",short:"q"}
  }}).values}catch(e){usage(e.message)}
  if(!args.suite)usage("Provide --suite <slug-or-id>.")
  if(!["strict","critical"].includes(args.gate))usage("--gate must be strict or critical.")
  const timeout=number(args.timeout,1,3600,"--timeout")
  const version=args.version===undefined?undefined:number(args.version,1,2147483647,"--version")
  const origin=args.url??process.env.NORE_URL??process.env.AGENTBENCH_URL
  let base
  try{base=new URL(origin)}catch{usage("Provide --url or set NORE_URL to a Nore origin.")}
  if(base.username||base.password||base.pathname!=="/"||base.search||base.hash||
    (base.protocol!=="https:"&&!(base.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(base.hostname))))usage("Use an HTTPS origin or a local HTTP origin.")
  let token=process.env.NORE_API_KEY??process.env.AGENTBENCH_API_KEY
  if(args["key-file"]){
    if(args["key-file"]==="-"){
      const chunks=[];let length=0
      for await(const chunk of process.stdin){length+=chunk.length;if(length>256)usage("The key input is too long.");chunks.push(chunk)}
      token=Buffer.concat(chunks).toString("utf8").trim()
    } else token=(await readFile(args["key-file"],"utf8")).trim()
  }
  if(!/^abk_[A-Za-z0-9_-]{43}$/.test(token??""))usage("Supply a valid API key in NORE_API_KEY or --key-file.")
  const key=args["idempotency-key"]??randomUUID()
  if(!/^[A-Za-z0-9._-]{8,120}$/.test(key))usage("--idempotency-key must contain 8–120 letters, digits, dots, dashes or underscores.")
  async function fetchApi(path,body){
    const result=await fetch(new URL("/api/v1/"+path,base),{redirect:"error",method:body?"POST":"GET",
      headers:{authorization:"Bearer "+token,...(body?{"content-type":"application/json","idempotency-key":key}:{})},
      body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)})
    const response=await result.json()
    if(!result.ok)throw new Error(response.error?.message??`API responded with HTTP ${result.status}.`)
    return response.data
  }
  let run=await fetchApi("runs",{suite:args.suite,agent:args.agent,version})
  if(!args.quiet)console.error(`Run ${run.id} submitted.`)
  const deadline=Date.now()+timeout*1000
  while(!terminal.has(run.status)){
    if(Date.now()>=deadline){console.error(`Polling timed out. Run ${run.id} may still be active.`);return 4}
    await delay(600)
    run=await fetchApi("runs/"+run.id)
  }
  const report=await fetchApi("reports/"+run.id)
  const evidence=JSON.stringify(report,null,2)+"\n"
  if(args.output&&args.output!=="-")await writeFile(args.output,evidence,{mode:0o600})
  if(args.json||args.output==="-")process.stdout.write(evidence)
  else {
    const {pass,fail,skip,infra,critical}=report.summary
    console.log(`${run.status}  ${run.id}\n${pass} passed · ${fail} failed · ${skip} skipped · ${infra} infrastructure · ${critical} critical`)
  }
  return exitFor(run,args.gate)
}
if(process.argv[1]){
  const {realpathSync}=await import("node:fs")
  const {fileURLToPath}=await import("node:url")
  if(realpathSync(process.argv[1])===fileURLToPath(import.meta.url)){
    try{process.exitCode=await main(process.argv.slice(2))}
    catch(error){console.error(`nore: ${error.message}`);if(error.exit===2)console.error("Run nore --help for usage.");process.exitCode=error.exit??5}
  }
}
