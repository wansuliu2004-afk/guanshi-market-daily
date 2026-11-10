import path from 'node:path';
import {readFile,writeFile,readdir,mkdir,access} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {DATA_DIR} from '../lib/collector.mjs';
import {root} from './build.mjs';

const seed=path.join(root,'deploy/initial-data.json.gz');
const permitted=name=>/^(?:site|sources|market-latest|market-dates)\.json$/.test(name)||/^(?:archive|markets|news|reports)\/\d{4}-\d{2}-\d{2}\.json$/.test(name);
async function entries(directory,prefix=''){
 const result=[];
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const relative=prefix+entry.name,file=path.join(directory,entry.name);
  if(entry.isDirectory())result.push(...await entries(file,relative+'/'));
  else if(permitted(relative))result.push([relative,JSON.parse(await readFile(file,'utf8'))]);
 }
 return result;
}
export async function restoreSeed(){
 try{await access(path.join(DATA_DIR,'site.json'));return false;}catch{}
 // 历史分支损坏时应报错，避免把已有云端历史覆盖成初始样本。
 const existing=await readdir(DATA_DIR).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
 if(existing.length)throw Error('数据目录已有内容却缺少 site.json，请检查历史分支，未覆盖已有记录');
 const files=JSON.parse(gunzipSync(await readFile(seed)).toString('utf8'));
 if(!files['site.json'])throw Error('初始归档缺少建站记录');
 for(const [name,value] of Object.entries(files)){
  if(!permitted(name))throw Error('初始归档路径不合法');
  const file=path.join(DATA_DIR,...name.split('/'));await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(value,null,2));
 }
 console.log('已恢复建站以来的初始记录，不补造停采期间历史。');return true;
}
if(process.argv.includes('--create')){
 await mkdir(path.dirname(seed),{recursive:true});
 const files=Object.fromEntries(await entries(DATA_DIR));if(!files['site.json'])throw Error('缺少 site.json');
 await writeFile(seed,gzipSync(JSON.stringify(files)));console.log(`已打包 ${Object.keys(files).length} 个初始数据文件`);
}
