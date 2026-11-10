import { mkdtempSync,readFileSync,readdirSync,rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { expect,it } from "vitest";
it("upgrades existing in-flight media with a cleanup deadline and preserves product deletion tombstones",async()=>{
  const directory=mkdtempSync(join(tmpdir(),"beforebig-privacy-upgrade-"));const client=createClient({url:"file:"+join(directory,"test.db")});
  try{
    for(const file of readdirSync("drizzle").filter(file=>file.endsWith(".sql")&&file<"0011").sort())await client.executeMultiple(readFileSync("drizzle/"+file,"utf8"));
    await client.execute("PRAGMA foreign_keys=ON");
    await client.executeMultiple("INSERT INTO users(id,email,created_at) VALUES ('u','sample@example.test',1000); INSERT INTO products(id,slug,name,website_url,normalized_domain,tagline,description,category,created_at,updated_at) VALUES ('p','p','Sample','https://p.example','p.example','Sample','Sample','Sample',1000,1000); INSERT INTO product_media(id,product_id,uploader_user_id,storage_key,alt_text,width,height,byte_size,sha256,rights_confirmed_at,created_at,updated_at) VALUES ('m','p','u','beforebig/media/sample.webp','Sample',64,64,1,'sample',1000,1000,1000);");
    await client.executeMultiple(readFileSync("drizzle/0011_account_cleanup_grace.sql","utf8"));
    expect((await client.execute("SELECT cleanup_after FROM product_media WHERE id='m'")).rows[0].cleanup_after).toBe(3601000);
    await client.execute("DELETE FROM products WHERE id='p'");const row=(await client.execute("SELECT product_id,status,deleted_at,cleanup_after FROM product_media WHERE id='m'")).rows[0];expect(row.product_id).toBeNull();expect(row.status).toBe("deleted");expect(row.deleted_at).not.toBeNull();expect(row.cleanup_after).toBe(3601000);
  }finally{client.close();rmSync(directory,{recursive:true,force:true});}
});
