import { NextRequest, NextResponse } from 'next/server';

async function checkAbangBenerin(area: string) {
  console.log(`[ABANGBENERIN] POST area:`, area);
  const res = await fetch('https://www.abangbenerin.com/api/location/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kota: area }),
  });
  const json = await res.json();
  console.log(`[ABANGBENERIN] Response for area '${area}':`, json);
  return json;
}

export async function POST(req: NextRequest) {
  try {
    const { area } = await req.json();
    if (!area) {
      return NextResponse.json({ error: 'Area is required' }, { status: 400 });
    }

    // Step 1: Cek ke abangbenerin dengan area user
    const resultKecil = await checkAbangBenerin(area);
    const notCovered = resultKecil.response && resultKecil.response.toLowerCase().includes('tidak tercover');

    if (!notCovered) {
      // Area user tercover, return langsung (positif)
      return NextResponse.json({
        area,
        abangbenerin: resultKecil,
        message: `Area ${area} tercover oleh abangbenerin.`
      });
    }

    // Step 2: Jika tidak tercover, baru cek ke Wikidata
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(area)}&language=id&format=json`;
    console.log(`[WIKIDATA] Search URL:`, searchUrl);
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    console.log(`[WIKIDATA] Search result for '${area}':`, searchData);
    if (!searchData.search || searchData.search.length === 0) {
      return NextResponse.json({
        area,
        abangbenerin: resultKecil,
        message: `Area tidak tercover. Mohon masukkan lokasi yang lebih jelas, misal: kecamatan, kota, atau kabupaten.`
      });
    }
    const qid = searchData.search[0].id;

    // Step 3: Get area details from Wikidata
    const detailUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    console.log(`[WIKIDATA] Detail URL:`, detailUrl);
    const detailRes = await fetch(detailUrl);
    const detailData = await detailRes.json();
    console.log(`[WIKIDATA] Detail result for QID '${qid}':`, detailData);
    const entity = detailData.entities[qid];
    let parentArea = null;
    let parentLabel = null;
    let parentDescription = null;
    if (entity && entity.claims && entity.claims.P131 && entity.claims.P131[0].mainsnak.datavalue) {
      const parentQid = entity.claims.P131[0].mainsnak.datavalue.value.id;
      const parentEntity = detailData.entities[parentQid];
      parentLabel = parentEntity?.labels?.id?.value || null;
      parentDescription = parentEntity?.descriptions?.id?.value || null;
      parentArea = { qid: parentQid, label: parentLabel, description: parentDescription };
    }

    // Step 4: Jika ada parent area, cek ke abangbenerin dengan area induk
    if (parentLabel) {
      const resultInduk = await checkAbangBenerin(parentLabel);
      const notCoveredInduk = resultInduk.response && resultInduk.response.toLowerCase().includes('tidak tercover');
      if (!notCoveredInduk) {
        return NextResponse.json({
          area: searchData.search[0].label,
          qid,
          parentArea,
          abangbenerin: resultKecil,
          abangbenerinInduk: resultInduk,
          message: `Area ${area} belum tercover, namun area induknya (${parentLabel}${parentDescription ? `, ${parentDescription}` : ''}) tercover. Silakan cek area lain di ${parentLabel}.`
        });
      }
    }

    // Step 5: Jika keduanya tidak tercover
    return NextResponse.json({
      area: searchData.search[0].label,
      qid,
      parentArea,
      abangbenerin: resultKecil,
      message: `Area tidak tercover. ${parentLabel ? `${area} adalah bagian dari ${parentLabel}${parentDescription ? `, ${parentDescription}` : ''}. ` : ''}Mohon masukkan lokasi yang lebih jelas, misal: kecamatan, kota, atau kabupaten.`
    });
  } catch (err) {
    console.error('[ERROR] area-check:', err);
    return NextResponse.json({ error: 'Internal server error', detail: String(err) }, { status: 500 });
  }
} 