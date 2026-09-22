async function testAI() {
  const res = await fetch('http://localhost:3001/api/ai/analyze/3', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customText: 'Clínica médica de 500m². Instalação elétrica trifásica com cabo 10mm² para alimentação principal e cabo 2.5mm² para 120 tomadas de equipamentos. Divisórias acústicas em drywall ST e piso porcelanato 80x80cm.'
    })
  });
  const data = await res.json();
  console.log('--- RESPOSTA API COMPLETA ---', data);
  console.log('Primeiro Item Extraído:', data.materials[0]);
}

testAI();
