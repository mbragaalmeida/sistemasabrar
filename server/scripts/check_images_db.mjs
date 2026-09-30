import fs from 'fs';
import { pool } from '../src/db/connection.js';

const baseXmlDir = 'C:/Users/Casa/.gemini/antigravity/brain/3ab2ef9d-0660-49bd-86c6-ba35b9f2d8ca/scratch/xlsx_full/xl';

async function main() {
  const res = await pool.query("SELECT id, code, name, category, image_url FROM materials WHERE image_url = '/materials/image114.png' LIMIT 6");
  console.log('Sample materials with image114:', res.rows);

  const resNull = await pool.query("SELECT id, code, name, category, image_url FROM materials WHERE image_url IS NULL LIMIT 6");
  console.log('Sample materials with NULL image_url:', resNull.rows);

  await pool.end();
}

main().catch(console.error);
