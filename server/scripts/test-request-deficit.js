async function testRequestDeficit() {
  const res = await fetch('http://localhost:3001/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: 1,
      materialId: 1,
      quantity: 500,
      priority: 'Urgente',
      notes: 'Teste automatizado de verificação de déficit de estoque',
      userId: 3
    })
  });
  const data = await res.json();
  console.log('--- TESTE DE SOLICITAÇÃO COM DÉFICIT ---');
  console.log('Código da Solicitação:', data.code);
  console.log('Status da Solicitação:', data.status);
  console.log('Quantidade Solicitada:', data.requestedQuantity);
  console.log('Quantidade Reservada do Estoque:', data.reservedQuantity);
  console.log('Déficit Calculado:', data.deficit);
  console.log('Demanda de Compra Automática Gerada:', data.purchaseDemand);
}

testRequestDeficit();
