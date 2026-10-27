import os
import zipfile
import re
import json
import shutil
import xml.etree.ElementTree as ET

BASE_DIR = r"C:\Users\Casa\OneDrive\Área de Trabalho\Matheus\Market Making\Sabrar Engenharia\Arquivos Sabrar"
OUTPUT_MEDIA_DIR = os.path.abspath(r"client\public\materials")
os.makedirs(OUTPUT_MEDIA_DIR, exist_ok=True)

files_to_process = [
    ("Itens incompletos - 15.10.xlsx", "inc15"),
    ("Itens incompletos - 21.10.xlsx", "inc21"),
    ("Itens incompletos - lista de materiais - fotos -1.xlsx", "inc_lista")
]

results = []

def parse_xlsx_images(file_path, prefix):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return {}

    with zipfile.ZipFile(file_path, 'r') as z:
        namelist = z.namelist()
        
        # 1. Extract all media files to OUTPUT_MEDIA_DIR with prefix
        media_files = [n for n in namelist if n.startswith('xl/media/')]
        extracted_media_map = {} # 'image1.png' -> 'inc21_image1.png'
        for mf in media_files:
            base_mf = os.path.basename(mf)
            new_fname = f"{prefix}_{base_mf}"
            target_path = os.path.join(OUTPUT_MEDIA_DIR, new_fname)
            with z.open(mf) as src, open(target_path, 'wb') as dst:
                shutil.copyfileobj(src, dst)
            extracted_media_map[base_mf] = f"/materials/{new_fname}"
        
        print(f"[{prefix}] Extracted {len(extracted_media_map)} media files from {os.path.basename(file_path)}")

        # 2. Parse richData
        row_to_image = {}
        if 'xl/richData/rdrichvalue.xml' in namelist and 'xl/richData/richValueRel.xml' in namelist:
            rich_rels_xml = z.read('xl/richData/_rels/richValueRel.xml.rels').decode('utf-8')
            rich_rel_xml = z.read('xl/richData/richValueRel.xml').decode('utf-8')
            rich_val_xml = z.read('xl/richData/rdrichvalue.xml').decode('utf-8')
            
            # rel_map: rId1 -> image1.png
            rel_map = dict(re.findall(r'<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"', rich_rels_xml))
            for k in rel_map:
                rel_map[k] = rel_map[k].replace('../media/', '')
            
            # rel_list
            rel_list = re.findall(r'<rel[^>]*r:id="([^"]+)"', rich_rel_xml)
            
            # rvs
            rv_matches = re.findall(r'<rv[^>]*>[\s\S]*?</rv>', rich_val_xml)
            rv_to_img = {}
            for idx, rv in enumerate(rv_matches):
                vm = re.search(r'<v>(\d+)</v>', rv)
                if vm:
                    rel_idx = int(vm.group(1))
                    if rel_idx < len(rel_list):
                        rId = rel_list[rel_idx]
                        orig_img = rel_map.get(rId)
                        if orig_img and orig_img in extracted_media_map:
                            rv_to_img[idx + 1] = extracted_media_map[orig_img]
            
            # Parse sheet1.xml to find <c r="B{row}" vm="{vm}">
            sheet1_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
            b_cells = re.findall(r'<c r="B(\d+)"[^>]*vm="(\d+)"', sheet1_xml)
            for r_str, vm_str in b_cells:
                row_num = int(r_str)
                vm = int(vm_str)
                img = rv_to_img.get(vm)
                if img:
                    row_to_image[row_num] = img

        # 3. Parse drawings if any
        if 'xl/drawings/drawing1.xml' in namelist:
            drawing_xml = z.read('xl/drawings/drawing1.xml').decode('utf-8')
            drawing_rels_name = 'xl/drawings/_rels/drawing1.xml.rels'
            if drawing_rels_name in namelist:
                drawing_rels = z.read(drawing_rels_name).decode('utf-8')
                draw_rel_map = dict(re.findall(r'<Relationship Id="([^"]+)"[^>]*Target="([^"]+)"', drawing_rels))
                for k in draw_rel_map:
                    draw_rel_map[k] = draw_rel_map[k].replace('../media/', '')
                
                anchors = re.findall(r'<xdr:(?:twoCellAnchor|oneCellAnchor)[\s\S]*?</xdr:(?:twoCellAnchor|oneCellAnchor)>', drawing_xml)
                for anchor in anchors:
                    blip = re.search(r'<a:blip[^>]*r:embed="([^"]+)"', anchor)
                    row_m = re.search(r'<xdr:from>[\s\S]*?<xdr:row>(\d+)</xdr:row>', anchor)
                    if blip and row_m:
                        rId = blip.group(1)
                        draw_row0 = int(row_m.group(1))
                        row_num = draw_row0 + 1
                        orig_img = draw_rel_map.get(rId)
                        if orig_img and orig_img in extracted_media_map:
                            if row_num not in row_to_image:
                                row_to_image[row_num] = extracted_media_map[orig_img]

        print(f"[{prefix}] Mapped {len(row_to_image)} rows to images")
        return row_to_image

# Parse all
all_mappings = {}
for fname, prefix in files_to_process:
    fpath = os.path.join(BASE_DIR, fname)
    m = parse_xlsx_images(fpath, prefix)
    all_mappings[fname] = m

with open("server/scripts/extracted_mappings.json", "w", encoding="utf-8") as f:
    json.dump(all_mappings, f, indent=2, ensure_ascii=False)

print("Saved to server/scripts/extracted_mappings.json")
