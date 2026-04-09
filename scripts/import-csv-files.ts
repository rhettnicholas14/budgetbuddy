import { readFile } from "node:fs/promises";
import { importCsvText } from "@/lib/csv/importer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase env. Ensure .env.local includes NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
}

async function main() {
  const filePaths = process.argv.slice(2);

  if (filePaths.length === 0) {
    throw new Error("Pass one or more CSV paths. Example: npm run import:csv -- '/path/file1.csv' '/path/file2.csv'");
  }

  for (const filePath of filePaths) {
    const content = await readFile(filePath, "utf8");
    const result = await importCsvText(filePath, content);
    console.log(`${filePath}: ${result.message}`);
  }
}

void main().catch((error) => {
  console.error("CSV import failed.");
  console.error(error);
  process.exit(1);
});
