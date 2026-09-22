/**
 * BASE ECONÔMICA SABRAR — COMPLEMENTO DO AGENTE DE LEVANTAMENTO
 * 
 * Fonte oficial de precificação unitária de materiais, serviços e logística da SABRAR Engenharia.
 * Contém 906 registros distribuídos em 10 categorias e 12 contextos de obra.
 * 
 * Regras de Uso:
 * 1. Correspondência por descrição + especificação + unidade + contexto/sistema.
 * 2. Rejeição quando houver diferença técnica de bitola, espessura, material, capacidade ou sistema.
 * 3. Priorização do registro cujo CONTEXTO corresponda ao sistema da obra.
 * 4. Preço zero não é preço válido. Item sem correspondência = PREÇO_NAO_LOCALIZADO.
 * 5. Preservação estrita de unidade e preço-base oficial.
 */

export const SABRAR_ECONOMIC_BASE_TEXT = "BASE ECONÔMICA SABRar — COMPLEMENTO DO AGENTE DE LEVANTAMENTO\n\nFINALIDADE: Esta base NÃO altera o prompt técnico de levantamento já existente. Ela deve ser usada somente para associar materiais/serviços já identificados pelo agente a unidades e preços unitários da base Sabrá.\n\nREGRAS DE USO:\n1. Faça correspondência por descrição + especificação + unidade + contexto/sistema.\n2. Nunca escolha um preço apenas por semelhança textual quando houver diferença técnica de bitola, espessura, material, capacidade ou sistema.\n3. Quando o mesmo item possuir preços diferentes em contextos diferentes, priorize o registro cujo CONTEXTO corresponda ao sistema da obra.\n4. Preço zero não é preço válido. Item sem correspondência deve permanecer no levantamento com PREÇO_NAO_LOCALIZADO.\n5. Valores abaixo são preços-base da planilha Sabrar analisada; preserve unidade e contexto.\n\nFORMATO DOS REGISTROS: [CATEGORIA] ITEM | UNIDADE | PREÇO_R$ | FORNECEDOR/DATA | CONTEXTO\n\n[Administrativo / logística] Alimentação | mês | R$ 900.0000 | - | AC - DIRETA - COBRE\n[Administrativo / logística] Alimentação | mês | R$ 900.0000 | - | AC - INDIRETA - AGUA\n[Administrativo / logística] Alimentação | mês | R$ 660.0000 | - | EX Cozinha\n[Administrativo / logística] Alimentação | mês | R$ 660.0000 | - | EX_AE\n[Administrativo / logística] Alimentação | mês | R$ 660.0000 | - | Pressurização\n[Administrativo / logística] ART | vb | R$ 350.0000 | - | AC - DIRETA - COBRE\n[Administrativo / logística] ART | vb | R$ 300.0000 | - | AC - INDIRETA - AGUA\n[Administrativo / logística] ART | vb | R$ 300.0000 | - | EX Cozinha\n[Administrativo / logística] ART | vb | R$ 300.0000 | - | EX_AE\n[Administrativo / logística] ART | vb | R$ 300.0000 | - | Pressurização\n[Administrativo / logística] As Built | vb | R$ 1500.0000 | - | AC - DIRETA - COBRE\n[Administrativo / logística] As Built | vb | R$ 1500.0000 | - | AC - INDIRETA - AGUA\n[Administrativo / logística] As Built | vb | R$ 1500.0000 | - | EX Cozinha\n[Administrativo / logística] As Built | vb | R$ 1500.0000 | - | EX_AE\n[Administrativo / logística] As Built | vb | R$ 1500.0000 | - | Pressurização\n[Administrativo / logística] Databook | vb | R$ 500.0000 | - | AC - DIRETA - COBRE\n[Administrativo / logística] Databook | vb | R$ 500.0000 | - | AC - INDIRETA - AGUA\n[Administrativo / logística] Databook | vb | R$ 500.0000 | - | EX Cozinha\n[Administrativo / logística] Databook | vb | R$ 500.0000 | - | EX_AE\n[Administrativo / logística] Databook | vb | R$ 500.0000 | - | Pressurização\n[Administrativo / logística] Engenheiro - salário-base | mês | R$ 8000.0000 | - | Custos ADM\n[Administrativo / logística] Gasolina | L | R$ 5.0000 | - | Custos ADM\n[Administrativo / logística] GEM | vb | R$ 1500.0000 | - | AC - DIRETA - COBRE\n[Administrativo / logística] GEM | vb | R$ 1500.0000 | - | AC - INDIRETA - AGUA\n[Administrativo / logística] GEM | vb | R$ 1500.0000 | - | EX Cozinha\n[Administrativo / logística] GEM | vb | R$ 1500.0000 | - | EX_AE\n[Administrativo / logística] GEM | vb | R$ 1500.0000 | - | Pressurização\n[Administrativo / logística] Hospedagem | mês | R$ 6000.0000 | - | AC - DIRETA - COBRE\n[Administrativo / logística] Hospedagem | mês | R$ 6000.0000 | - | AC - INDIRETA - AGUA\n[Administrativo / logística] Hospedagem | mês | R$ 3000.0000 | - | EX Cozinha\n[Administrativo / logística] Hospedagem | mês | R$ 3000.0000 | - | EX_AE\n[Administrativo / logística] Hospedagem | mês | R$ 3000.0000 | - | Pressurização\n[Administrativo / logística] Içamento | diária | R$ 6800.0000 | - | AC - DIRETA - COBRE\n[Administrativo / logística] Içamento | diária | R$ 6800.0000 | - | AC - INDIRETA - AGUA\n[Administrativo / logística] Içamento | diária | R$ 6800.0000 | - | EX Cozinha\n[Administrativo / logística] Içamento | diária | R$ 6800.0000 | - | EX_AE\n[Administrativo / logística] Içamento | diária | R$ 6800.0000 | - | Pressurização\n[Administrativo / logística] Manual | vb | R$ 500.0000 | - | AC - DIRETA - COBRE\n[Administrativo / logística] Manual | vb | R$ 500.0000 | - | AC - INDIRETA - AGUA\n[Administrativo / logística] Manual | vb | R$ 500.0000 | - | EX Cozinha\n[Administrativo / logística] Manual | vb | R$ 500.0000 | - | EX_AE\n[Administrativo / logística] Manual | vb | R$ 500.0000 | - | Pressurização\n[Administrativo / logística] Passagem Aérea (2x por mês) | qtd | R$ 3500.0000 | - | AC - DIRETA - COBRE\n[Administrativo / logística] Passagem Aérea (2x por mês) | qtd | R$ 3500.0000 | - | AC - INDIRETA - AGUA\n[Administrativo / logística] Passagem Aérea (2x por mês) | qtd | R$ 2500.0000 | - | EX Cozinha\n[Administrativo / logística] Passagem Aérea (2x por mês) | qtd | R$ 2500.0000 | - | EX_AE\n[Administrativo / logística] Passagem Aérea (2x por mês) | qtd | R$ 2500.0000 | - | Pressurização\n[Administrativo / logística] Picagem/Trepanação Tubulação - SEM DRENAGEM DE ÁGUA (DUAS LINHAS) (CONGELAMENTO) | vb | R$ 16000.0000 | - | AC - INDIRETA - AGUA\n[Administrativo / logística] Plataforma elevatória - se for pé direito duplo | mês | R$ 10000.0000 | - | AC - DIRETA - COBRE\n[Administrativo / logística] Plataforma elevatória - se for pé direito duplo | mês | R$ 10000.0000 | - | AC - INDIRETA - AGUA\n[Administrativo / logística] Plataforma elevatória - se for pé direito duplo | mês | R$ 10000.0000 | - | EX Cozinha\n[Administrativo / logística] Plataforma elevatória - se for pé direito duplo | mês | R$ 10000.0000 | - | EX_AE\n[Administrativo / logística] Plataforma elevatória - se for pé direito duplo | mês | R$ 10000.0000 | - | Pressurização\n[Administrativo / logística] Supervisor - 6 Horas - 22 Dias/ Mês | mês | R$ 12000.0000 | - | AC - DIRETA - COBRE\n[Administrativo / logística] Supervisor - 6 Horas - 22 Dias/ Mês | mês | R$ 12000.0000 | - | AC - INDIRETA - AGUA\n[Administrativo / logística] Supervisor - 6 Horas - 22 Dias/ Mês | mês | R$ 12000.0000 | - | EX Cozinha\n[Administrativo / logística] Supervisor - 6 Horas - 22 Dias/ Mês | mês | R$ 12000.0000 | - | EX_AE\n[Administrativo / logística] Supervisor - 6 Horas - 22 Dias/ Mês | mês | R$ 12000.0000 | - | Pressurização\n[Administrativo / logística] Supervisor - salário-base | mês | R$ 5000.0000 | - | Custos ADM\n[Administrativo / logística] Transporte | mês | R$ 550.0000 | - | AC - DIRETA - COBRE\n[Administrativo / logística] Transporte | mês | R$ 550.0000 | - | AC - INDIRETA - AGUA\n[Administrativo / logística] Transporte | mês | R$ 390.0000 | - | EX Cozinha\n[Administrativo / logística] Transporte | mês | R$ 390.0000 | - | EX_AE\n[Administrativo / logística] Transporte | mês | R$ 390.0000 | - | Pressurização\n[Automação] Automação Simples - Stand Alone (Quadro) | unid | R$ 25000.0000 | - | AC - INDIRETA - AGUA\n[Automação] Quadro de Automação de Pressurização p/ ventilador com inversor de frequência, contactora, dispositivos de proteção, proteção, painél com chaves seletores e botão seco - 1 VENTILADOR | vb | R$ 28000.0000 | Services BR | EX_AE\n[Automação] Quadro de Automação de Pressurização p/ ventilador com inversor de frequência, contactora, dispositivos de proteção, proteção, painél com chaves seletores e botão seco - 2 VENTILADORES | vb | R$ 40000.0000 | Services BR | EX_AE\n[Dutos] Chapa Alumínio - Matéria Prima e Fabricação | kg | R$ 35.0000 | Espiroduto | AC - DIRETA - COBRE\n[Dutos] Chapa Alumínio - Matéria Prima e Fabricação | kg | R$ 35.0000 | Espiroduto | AC - INDIRETA - AGUA\n[Dutos] Chapa Galvanizada - Exaustão e Ventilação | KG | R$ 14.0000 | --- | EX Cozinha\n[Dutos] Chapa Galvanizada - Exaustão e Ventilação | KG | R$ 14.0000 | --- | Pressurização\n[Dutos] Chapa Galvanizada - Exaustão e Ventilação (Revestimento B) | KG | R$ 12.0000 | --- | EX_AE\n[Dutos] Chapa Galvanizada - Insuflamento e Retorno | KG | R$ 12.0000 | --- | AC - INDIRETA - AGUA\n[Dutos] Chapa Galvanizada - Insuflamento e Retorno (Revestimento B) | KG | R$ 12.0000 | Felipe - 29-12-25 | AC - DIRETA - COBRE\n[Dutos] Chapa Galvanizada - Matéria Prima e Fabricação | kg | R$ 30.0000 | Espiroduto - Junho/26 | AC - DIRETA - COBRE\n[Dutos] Chapa Galvanizada - Matéria Prima e Fabricação | kg | R$ 90.0000 | Espiroduto | AC - INDIRETA - AGUA\n[Dutos] Chapa Preta - Exaustão | KG | R$ 12.0000 | --- | EX Cozinha\n[Dutos] Chapa Preta - Exaustão | KG | R$ 12.0000 | --- | Pressurização\n[Dutos] Dutos Flexivéis - 100 mm (unid c/ 6m) - ISODEC 4\" | pç | R$ 105.0000 | ITERMIL - 03/07/26 | AC - DIRETA - COBRE\n[Dutos] Dutos Flexivéis - 100 mm (unid c/ 6m) - ISODEC 4\" | pç | R$ 105.0000 | ITERMIL - 03/07/26 | AC - INDIRETA - AGUA\n[Dutos] Dutos Flexivéis - 150 mm (unid c/ 6m) - ISODEC 6\" | pç | R$ 143.0000 | ITERMIL - 03/07/26 | AC - DIRETA - COBRE\n[Dutos] Dutos Flexivéis - 150 mm (unid c/ 6m) - ISODEC 6\" | pç | R$ 143.0000 | ITERMIL - 03/07/26 | AC - INDIRETA - AGUA\n[Dutos] Dutos Flexivéis - 200 mm (unid c/ 6m) - ISODEC 8\" | pç | R$ 186.0000 | ITERMIL - 03/07/26 | AC - DIRETA - COBRE\n[Dutos] Dutos Flexivéis - 200 mm (unid c/ 6m) - ISODEC 8\" | pç | R$ 186.0000 | ITERMIL - 03/07/26 | AC - INDIRETA - AGUA\n[Dutos] Dutos Flexivéis - 250 mm (unid c/ 6m) - ISODEC 10\" | pç | R$ 228.0000 | ITERMIL - 03/07/26 | AC - DIRETA - COBRE\n[Dutos] Dutos Flexivéis - 250 mm (unid c/ 6m) - ISODEC 10\" | pç | R$ 228.0000 | ITERMIL - 03/07/26 | AC - INDIRETA - AGUA\n[Dutos] Dutos Flexivéis - 300 mm (unid c/ 6m) - ISODEC 12\" | pç | R$ 287.0000 | ITERMIL - 03/07/26 | AC - DIRETA - COBRE\n[Dutos] Dutos Flexivéis - 300 mm (unid c/ 6m) - ISODEC 12\" | pç | R$ 287.0000 | ITERMIL - 03/07/26 | AC - INDIRETA - AGUA\n[Dutos] Fita Cyclop - Arquear | m | R$ 0.2000 | 01/07/2026 | AC - DIRETA - COBRE\n[Dutos] Fita Cyclop - Arquear | m | R$ 0.2000 | 01/07/2026 | AC - INDIRETA - AGUA\n[Dutos] Fita Cyclop - Arquear | m | R$ 0.2000 | 01/07/2026 | EX Cozinha\n[Dutos] Fita Cyclop - Arquear | m | R$ 0.2000 | 01/07/2026 | Pressurização\n[Dutos] Fita vitocel - TDC | m | R$ 1.2600 | 01/07/2026 | AC - DIRETA - COBRE\n[Dutos] Fita vitocel - TDC | m | R$ 1.2600 | 01/07/2026 | AC - INDIRETA - AGUA\n[Dutos] Fita vitocel - TDC | m | R$ 1.2600 | 01/07/2026 | EX Cozinha\n[Dutos] Fita vitocel - TDC | m | R$ 1.2600 | 01/07/2026 | EX_AE\n[Dutos] Fita vitocel - TDC | m | R$ 1.5000 | - | Pressurização\n[Dutos] Limpeza de dutos | m linear | R$ 12.0000 | - | AC - DIRETA - COBRE\n[Dutos] Limpeza de dutos | m linear | R$ 12.0000 | - | AC - INDIRETA - AGUA\n[Dutos] Limpeza de dutos | m linear | R$ 12.0000 | - | EX_AE\n[Dutos] Limpeza de dutos | m linear | R$ 12.0000 | - | Pressurização\n[Dutos] Manta de silicone para 200 graus | m | R$ 200.0000 | SIENA VEDAÇÃO 25/02/2026 | EX Cozinha\n[Dutos] Manta de silicone para 200 graus | m | R$ 200.0000 | SIENA VEDAÇÃO 25/02/2026 | Pressurização\n[Dutos] Pintura dos dutos (Tinta+acessórios e MDO) | m² | R$ 100.0000 | - | AC - DIRETA - COBRE\n[Dutos] Pintura dos dutos (Tinta+acessórios e MDO) | m² | R$ 100.0000 | - | AC - INDIRETA - AGUA\n[Dutos] Pintura dos dutos (Tinta+acessórios e MDO) | m² | R$ 100.0000 | - | EX Cozinha\n[Dutos] Pintura dos dutos (Tinta+acessórios e MDO) | m² | R$ 100.0000 | - | EX_AE\n[Dutos] Pintura dos dutos (Tinta+acessórios e MDO) | m² | R$ 100.0000 | - | Pressurização\n[Dutos] Porta de inspeção (SOMENTE SE NECESSÁRIO) | unid | R$ 130.0000 | Não | AC - DIRETA - COBRE\n[Dutos] Porta de inspeção (SOMENTE SE NECESSÁRIO) | unid | R$ 130.0000 | Não | AC - INDIRETA - AGUA\n[Dutos] Porta de inspeção (SOMENTE SE SOLICITADO) | unid | R$ 130.0000 | Não | EX Cozinha\n[Dutos] Porta de inspeção (SOMENTE SE SOLICITADO) | unid | R$ 130.0000 | Não | EX_AE\n[Dutos] Porta de inspeção (SOMENTE SE SOLICITADO) | unid | R$ 130.0000 | Não | Pressurização\n[Dutos] Porta de Inspeção - a cada 1,1 metro | unid | R$ 250.0000 | - | EX Cozinha\n[Dutos] Porta de Inspeção - a cada 1,1 metro | unid | R$ 230.0000 | - | Pressurização\n[Dutos] Remanejamento de duto | kg *2 | R$ 150.0000 | - | AC - DIRETA - COBRE\n[Dutos] Remanejamento de duto | m linear | R$ 150.0000 | - | EX_AE\n[Dutos] Remanejamento de duto | m linear | R$ 150.0000 | - | Pressurização\n[Dutos] Silicone p/ TDC - Sikaflex | pç | R$ 12.0900 | - | AC - DIRETA - COBRE\n[Dutos] Silicone p/ TDC - Sikaflex | pç | R$ 12.0900 | - | AC - INDIRETA - AGUA\n[Dutos] Silicone p/ TDC - Sikaflex | pç | R$ 12.0900 | - | EX Cozinha\n[Dutos] Silicone p/ TDC - Sikaflex | pç | R$ 12.0900 | - | EX_AE\n[Dutos] Silicone p/ TDC - Sikaflex | pç | R$ 19.0000 | - | Pressurização\n[Dutos] Silicone vermelho | pç | R$ 26.0000 | 46146 | EX Cozinha\n[Dutos] Silicone vermelho | pç | R$ 26.0000 | 46146 | Pressurização\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 8900.0000 | MS Quadros - 04-08-26 | AC - INDIRETA - AGUA\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 8900.0000 | MS Quadros - 04-08-26 | EX Cozinha\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 8900.0000 | MS Quadros - 04-08-26 | EX_AE\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 8900.0000 | MS Quadros - 04-08-26 | Pressurização\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 V OU 380 V (PARTIDA DIRETA) | unid | R$ 3900.0000 | MS Quadros - 04-08-26 | AC - INDIRETA - AGUA\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 V OU 380 V (PARTIDA DIRETA) | unid | R$ 3900.0000 | MS Quadros - 04-08-26 | EX Cozinha\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 V OU 380 V (PARTIDA DIRETA) | unid | R$ 3900.0000 | MS Quadros - 04-08-26 | EX_AE\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 V OU 380 V (PARTIDA DIRETA) | unid | R$ 3900.0000 | MS Quadros - 04-08-26 | Pressurização\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 6600.0000 | MS Quadros - 04-08-26 | AC - INDIRETA - AGUA\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 6600.0000 | MS Quadros - 04-08-26 | EX Cozinha\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 6600.0000 | MS Quadros - 04-08-26 | EX_AE\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 6600.0000 | MS Quadros - 04-08-26 | Pressurização\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 7800.0000 | MS Quadros - 04-08-26 | AC - INDIRETA - AGUA\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 7800.0000 | MS Quadros - 04-08-26 | EX Cozinha\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 7800.0000 | MS Quadros - 04-08-26 | EX_AE\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 7800.0000 | MS Quadros - 04-08-26 | Pressurização\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR DE 12.5 CV ATÉ 15 CV 380 VCA (PARTIDA SOFT STARTER) | unid | R$ 7800.0000 | MS Quadros - 04-08-26 | AC - INDIRETA - AGUA\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR DE 12.5 CV ATÉ 15 CV 380 VCA (PARTIDA SOFT STARTER) | unid | R$ 7800.0000 | MS Quadros - 04-08-26 | EX Cozinha\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR DE 12.5 CV ATÉ 15 CV 380 VCA (PARTIDA SOFT STARTER) | unid | R$ 7800.0000 | MS Quadros - 04-08-26 | EX_AE\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR DE 12.5 CV ATÉ 15 CV 380 VCA (PARTIDA SOFT STARTER) | unid | R$ 7800.0000 | MS Quadros - 04-08-26 | Pressurização\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5 CV ATÉ 10 CV 380 VCA (PARTIDA SOFT STARTER) | unid | R$ 6900.0000 | MS Quadros - 04-08-26 | AC - INDIRETA - AGUA\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5 CV ATÉ 10 CV 380 VCA (PARTIDA SOFT STARTER) | unid | R$ 6900.0000 | MS Quadros - 04-08-26 | EX Cozinha\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5 CV ATÉ 10 CV 380 VCA (PARTIDA SOFT STARTER) | unid | R$ 6900.0000 | MS Quadros - 04-08-26 | EX_AE\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5 CV ATÉ 10 CV 380 VCA (PARTIDA SOFT STARTER) | unid | R$ 6900.0000 | MS Quadros - 04-08-26 | Pressurização\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5CV ATÉ 15 CV SENDO 220 VCA (PARTIDA ESTRELA TRIANGULO) | unid | R$ 3600.0000 | MS Quadros - 04-08-26 | AC - INDIRETA - AGUA\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5CV ATÉ 15 CV SENDO 220 VCA (PARTIDA ESTRELA TRIANGULO) | unid | R$ 3600.0000 | MS Quadros - 04-08-26 | EX Cozinha\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5CV ATÉ 15 CV SENDO 220 VCA (PARTIDA ESTRELA TRIANGULO) | unid | R$ 3600.0000 | MS Quadros - 04-08-26 | EX_AE\n[Elétrica] QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5CV ATÉ 15 CV SENDO 220 VCA (PARTIDA ESTRELA TRIANGULO) | unid | R$ 3600.0000 | MS Quadros - 04-08-26 | Pressurização\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 14600.0000 | MS Quadros - 04-08-26 | AC - INDIRETA - AGUA\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 14600.0000 | MS Quadros - 04-08-26 | EX Cozinha\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 14600.0000 | MS Quadros - 04-08-26 | EX_AE\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 14600.0000 | MS Quadros - 04-08-26 | Pressurização\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (PARTIDA DIRETA) | unid | R$ 4800.0000 | MS Quadros - 04-08-26 | AC - INDIRETA - AGUA\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (PARTIDA DIRETA) | unid | R$ 4800.0000 | MS Quadros - 04-08-26 | EX Cozinha\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (PARTIDA DIRETA) | unid | R$ 4800.0000 | MS Quadros - 04-08-26 | EX_AE\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (PARTIDA DIRETA) | unid | R$ 4800.0000 | MS Quadros - 04-08-26 | Pressurização\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES DE 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 21700.0000 | MS Quadros - 04-08-26 | AC - INDIRETA - AGUA\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES DE 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 21700.0000 | MS Quadros - 04-08-26 | EX Cozinha\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES DE 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 21700.0000 | MS Quadros - 04-08-26 | EX_AE\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES DE 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 21700.0000 | MS Quadros - 04-08-26 | Pressurização\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES DE 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 17500.0000 | MS Quadros - 04-08-26 | AC - INDIRETA - AGUA\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES DE 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 17500.0000 | MS Quadros - 04-08-26 | EX Cozinha\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES DE 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 17500.0000 | MS Quadros - 04-08-26 | EX_AE\n[Elétrica] QUADRO ELÉTRICO PARA 03 MOTORES DE 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA) | unid | R$ 17500.0000 | MS Quadros - 04-08-26 | Pressurização\n[Hidráulica / acessórios] Armafix - 1 1/2\" - 48 | unid | R$ 44.1100 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Armafix - 1 1/4\" - 42 | unid | R$ 38.5200 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Armafix - 1\" - 35 | unid | R$ 37.5800 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Armafix - 2 1/2\" - 76 | unid | R$ 69.8800 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Armafix - 2\" - 60 | unid | R$ 53.6700 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Armafix - 3\" - 89 | unid | R$ 80.6900 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Armafix - 3/4\" - 28 | unid | R$ 35.5900 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Armafix - 4\" - 114 | unid | R$ 122.4800 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Armafix - 5\" - 140 | unid | R$ 157.2600 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Armafix - 6\" - 168 | unid | R$ 225.8900 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Armafix - 8\" - 219 | unid | R$ 577.5300 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] FILTRO TIPO Y, LATÃO, COM ROSCA BSP, 1 1/2\" | - | R$ 229.2000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] FILTRO TIPO Y, LATÃO, COM ROSCA BSP, 1 1/4\" | - | R$ 165.6000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] FILTRO TIPO Y, LATÃO, COM ROSCA BSP, 2 1/2\" | - | R$ 618.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] FILTRO TIPO Y, LATÃO, COM ROSCA BSP, 2\" | - | R$ 386.4000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] FILTRO TIPO Y, LATÃO, COM ROSCA BSP, 3\" | - | R$ 858.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Filtro Y 1\" | Unid. | R$ 66.0000 | - | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Filtro Y 3/4\" | Unid. | R$ 45.0000 | - | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Filtro Y Ferro fundido com flange- 5\" | unid | R$ 2904.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Filtro Y Ferro fundido com flange- 6\" | unid | R$ 3696.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Manômetro com Glicerina 10Kg | Unid. | R$ 170.0000 | - | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] MANÔMETRO RETO, C/GLICERINA MOSTRADOR 4\", ESCALA 0 à 10 KGF, ROSCA 1/2\" | - | R$ 270.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Manômetro reto, mostrados de 4\", escala 0 a 100 pSI x 7KGF, rosca de 1/2\" | unid | R$ 270.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Poço para Termômetro | Unid. | R$ 44.0000 | - | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Poço para Termômetro | Unid. | R$ 65.0000 | - | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Termômetro Capela 0-50 | Unid. | R$ 205.0000 | - | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Termômetro capela reto, 0 a50ºC, Haste de 50mm, Rosca de 1/2 | unid | R$ 468.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] valvula energy valve - 5\" | unid | R$ 59899.3800 | - | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] VALVULA GBC - 10s - 009L7051 - 3/8\" | unid. | R$ 119.2000 | 08/05/2026 | AC - DIRETA - COBRE\n[Hidráulica / acessórios] VALVULA GBC - 12s - 009L7052 - 1/2\" | unid. | R$ 123.2000 | 08/05/2026 | AC - DIRETA - COBRE\n[Hidráulica / acessórios] VALVULA GBC - 16s - 009L7053 - 5/8\" | unid. | R$ 122.4000 | 08/05/2026 | AC - DIRETA - COBRE\n[Hidráulica / acessórios] VALVULA GBC - 18s - 009L7054 - 3/4\" | unid. | R$ 214.7000 | 08/05/2026 | AC - DIRETA - COBRE\n[Hidráulica / acessórios] VALVULA GBC - 22s - 009L7055 - 7/8\" | unid. | R$ 215.6500 | 08/05/2026 | AC - DIRETA - COBRE\n[Hidráulica / acessórios] VALVULA GBC - 28s - 009L7056 - 1 1/8\" | unid. | R$ 302.1000 | 08/05/2026 | AC - DIRETA - COBRE\n[Hidráulica / acessórios] VALVULA GBC - 35s - 009L7057 - 1 3/8\" | unid. | R$ 580.5200 | 08/05/2026 | AC - DIRETA - COBRE\n[Hidráulica / acessórios] VALVULA GBC - 42s - 009L7058 - 1 5/8\" | unid. | R$ 704.7200 | 08/05/2026 | AC - DIRETA - COBRE\n[Hidráulica / acessórios] VALVULA GBC - 6s - 009L7050 - 1/4\" | unid. | R$ 151.2000 | 08/05/2026 | AC - DIRETA - COBRE\n[Hidráulica / acessórios] Válvula 2 vias de controle On Off - 1\" | Unid. | R$ 1027.8400 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Válvula 2 vias de controle On Off - 3/4\" | Unid. | R$ 1066.9100 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] VÁLVULA BLOQUEIO 1 1/2\" OFERTAMOS VALVULA ESFERA MONOBLOCO ROSCA 1 1/2\" | - | R$ 201.6000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] VÁLVULA BLOQUEIO 1 1/4\" OFERTAMOS VALVULA ESFERA MONOBLOCO ROSCA 1 1/4\" | - | R$ 154.8000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] VÁLVULA BLOQUEIO 1/2\" OFERTAMOS VALVULA ESFERA MONOBLOCO, ROSCA BSP 1/2\" | - | R$ 37.2000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] VÁLVULA BLOQUEIO 1/2\" OFERTAMOS VALVULA ESFERA MONOBLOCO, ROSCA BSP 1/2\" | - | R$ 42.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] VÁLVULA BLOQUEIO 2 1/2\" OFERTAMOS VALVULA ESFERA MONOBLOCO ROSCA 2 1/2\" | - | R$ 936.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] VÁLVULA BLOQUEIO 2\" OFERTAMOS VALVULA ESFERA MONOBLOCO ROSCA 2\" | - | R$ 327.6000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] VÁLVULA BLOQUEIO 3\" OFERTAMOS VALVULA ESFERA MONOBLOCO C/ROSCA BSP 3\" | - | R$ 1082.4000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Válvula borboleta tipo Wafer Motorizada - 5\" AT Eletrico 100NM 220V | unid | R$ 5952.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Válvula borboleta tipo Wafer Motorizada - 6\" AT Eletrico 100NM 220V | unid | R$ 6240.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Válvula borboleta wafe, acionamento alavanca - 5\" | unid | R$ 1164.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Válvula esfera Bipartida, aço carbono, ANSI-150-LBS-RF- 5\" | unid | R$ 7056.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Válvula esfera Bipartida, aço carbono, ANSI-150-LBS-RF- 6\" | unid | R$ 7056.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Hidráulica / acessórios] Válvula independente de pressão EV 2 vias, 6\" - 24V, GPM 713 + Atuador | unid | R$ 106000.0000 | By Import - 03-07-2026 | AC - INDIRETA - AGUA\n[Isolamento] 1 1/2\" - ARMAFLEX H 13 MM | m | R$ 24.0000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 1/2\" - ARMAFLEX H 13 MM | m | R$ 24.0000 | ITERMIL | Isolamento Padrão\n[Isolamento] 1 1/2\" - ARMAFLEX M 19 MM | m | R$ 41.4500 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 1/2\" - ARMAFLEX M 19 MM | m | R$ 41.4500 | ITERMIL | Isolamento Padrão\n[Isolamento] 1 1/2\" - ARMAFLEX R 32,5 MM | m | R$ 63.1200 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 1/2\" - ARMAFLEX R 32,5 MM | m | R$ 63.1200 | ITERMIL | Isolamento Especial\n[Isolamento] 1 1/2\" - ARMAFLEX T 45 MM | m | R$ 95.4200 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 1/2\" - ARMAFLEX T 45 MM | m | R$ 95.4200 | ITERMIL | Isolamento Especial\n[Isolamento] 1 1/2\" – SA H/M 038/038 | 26.95 | R$ 45.0000 | 1 1/2\" – SA H/M 038/038 | Isolamento Especial\n[Isolamento] 1 1/2\" – SA R/T 038/038 | 26.95 | R$ 53.0000 | 1 1/2\" – SA R/T 038/038 | Isolamento Especial\n[Isolamento] 1 1/4\" - ARMAFLEX H 13 MM | m | R$ 19.5000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 1/4\" - ARMAFLEX H 13 MM | m | R$ 19.5000 | ITERMIL | Isolamento Padrão\n[Isolamento] 1 1/4\" - ARMAFLEX R 32,5 MM | m | R$ 57.5100 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 1/4\" - ARMAFLEX R 32,5 MM | m | R$ 57.5100 | ITERMIL | Isolamento Especial\n[Isolamento] 1 1/4\" - ARMAFLEX T 45 MM | m | R$ 82.8800 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 1/4\" - ARMAFLEX T 45 MM | m | R$ 82.8800 | ITERMIL | Isolamento Especial\n[Isolamento] 1 1/4\" – SA H/M 032/035 | 23.45 | R$ 43.0000 | 1 1/4\" – SA H/M 032/035 | Isolamento Especial\n[Isolamento] 1 1/4\" – SA R/T 032/035 | 23.45 | R$ 48.5000 | 1 1/4\" – SA R/T 032/035 | Isolamento Especial\n[Isolamento] 1 1/4\"- ARMAFLEX M 19 MM | m | R$ 38.2200 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 1/4\"- ARMAFLEX M 19 MM | m | R$ 38.2200 | ITERMIL | Isolamento Padrão\n[Isolamento] 1 1/8\" - ARMAFLEX H 13 MM | m | R$ 17.5000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 1/8\" - ARMAFLEX H 13 MM | m | R$ 17.5000 | ITERMIL | Isolamento Padrão\n[Isolamento] 1 1/8\" - ARMAFLEX M 19 MM | m | R$ 36.3600 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 1/8\" - ARMAFLEX M 19 MM | m | R$ 36.3600 | ITERMIL | Isolamento Especial\n[Isolamento] 1 1/8\" - ARMAFLEX M 19 MM | m | R$ 36.3600 | ITERMIL | Isolamento Padrão\n[Isolamento] 1 1/8\" - ARMAFLEX R 32,5 MM | m | R$ 49.4000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 1/8\" - ARMAFLEX R 32,5 MM | m | R$ 49.4000 | ITERMIL | Isolamento Especial\n[Isolamento] 1 1/8\" - ARMAFLEX T 45 MM | m | R$ 75.7900 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 1/8\" - ARMAFLEX T 45 MM | m | R$ 75.7900 | ITERMIL | Isolamento Especial\n[Isolamento] 1 1/8\" – SA H/M 025/028 | 23.45 | R$ 41.0000 | 1 1/8\" – SA H/M 025/028 | Isolamento Especial\n[Isolamento] 1 1/8\" – SA R/T 025/028 | 23.45 | R$ 46.0000 | 1 1/8\" – SA R/T 025/028 | Isolamento Especial\n[Isolamento] 1 3/8\" - ARMAFLEX H 13 MM | m | R$ 21.5000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 3/8\" - ARMAFLEX H 13 MM | m | R$ 21.5000 | ITERMIL | Isolamento Padrão\n[Isolamento] 1 3/8\" - ARMAFLEX M 19 MM | m | R$ 40.4000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 3/8\" - ARMAFLEX M 19 MM | m | R$ 40.4000 | ITERMIL | Isolamento Padrão\n[Isolamento] 1 3/8\" - ARMAFLEX R 32,5 MM | m | R$ 60.6400 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 3/8\" - ARMAFLEX R 32,5 MM | m | R$ 60.6400 | ITERMIL | Isolamento Especial\n[Isolamento] 1 3/8\" - ARMAFLEX T 45 MM | m | R$ 88.1400 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 3/8\" - ARMAFLEX T 45 MM | m | R$ 88.1400 | ITERMIL | Isolamento Especial\n[Isolamento] 1 3/8\" – SA H/M 032/035 | 26.95 | R$ 43.0000 | 1 3/8\" – SA H/M 032/035 | Isolamento Especial\n[Isolamento] 1 3/8\" – SA R/T 032/035 | 26.95 | R$ 48.5000 | 1 3/8\" – SA R/T 032/035 | Isolamento Especial\n[Isolamento] 1 5/8\" - ARMAFLEX H 13 MM | m | R$ 26.8000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 5/8\" - ARMAFLEX H 13 MM | m | R$ 26.8000 | ITERMIL | Isolamento Padrão\n[Isolamento] 1 5/8\" - ARMAFLEX R 32,5 MM | m | R$ 67.0600 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 5/8\" - ARMAFLEX R 32,5 MM | m | R$ 67.0600 | ITERMIL | Isolamento Especial\n[Isolamento] 1 5/8\" - ARMAFLEX T 45 MM | m | R$ 102.5900 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 5/8\" - ARMAFLEX T 45 MM | m | R$ 102.5900 | ITERMIL | Isolamento Especial\n[Isolamento] 1 5/8\" – SA H/M 040/040 | 33.65 | R$ 46.0000 | 1 5/8\" – SA H/M 040/040 | Isolamento Especial\n[Isolamento] 1 5/8\" – SA R/T 040/042 | 33.65 | R$ 49.5000 | 1 5/8\" – SA R/T 040/042 | Isolamento Especial\n[Isolamento] 1 5/8\"- ARMAFLEX M 19 MM | m | R$ 46.9800 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 5/8\"- ARMAFLEX M 19 MM | m | R$ 46.9800 | ITERMIL | Isolamento Padrão\n[Isolamento] 1 7/8\" - ARMAFLEX H 13 MM | m | R$ 30.3000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 7/8\" - ARMAFLEX H 13 MM | m | R$ 30.3000 | ITERMIL | Isolamento Padrão\n[Isolamento] 1 7/8\" - ARMAFLEX M 19 MM | m | R$ 50.7600 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 7/8\" - ARMAFLEX M 19 MM | m | R$ 50.7600 | ITERMIL | Isolamento Padrão\n[Isolamento] 1 7/8\" - ARMAFLEX R 32,5 MM | m | R$ 74.3200 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 7/8\" - ARMAFLEX R 32,5 MM | m | R$ 74.3200 | ITERMIL | Isolamento Especial\n[Isolamento] 1 7/8\" - ARMAFLEX T 45 MM | m | R$ 114.4300 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1 7/8\" - ARMAFLEX T 45 MM | m | R$ 114.4300 | ITERMIL | Isolamento Especial\n[Isolamento] 1 7/8\" – SA H/M 048/048 | 33.65 | R$ 46.5000 | 1 7/8\" – SA H/M 048/048 | Isolamento Especial\n[Isolamento] 1 7/8\" – SA R/T 048/048 | 33.65 | R$ 60.0000 | 1 7/8\" – SA R/T 048/048 | Isolamento Especial\n[Isolamento] 1\" - ARMAFLEX H 13 MM | m | R$ 15.8000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1\" - ARMAFLEX H 13 MM | m | R$ 15.8000 | ITERMIL | Isolamento Padrão\n[Isolamento] 1\" - ARMAFLEX M 19 MM | m | R$ 30.2100 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1\" - ARMAFLEX M 19 MM | m | R$ 30.2100 | ITERMIL | Isolamento Especial\n[Isolamento] 1\" - ARMAFLEX M 19 MM | m | R$ 30.2100 | ITERMIL | Isolamento Padrão\n[Isolamento] 1\" - ARMAFLEX R 32,5 MM | m | R$ 46.3500 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1\" - ARMAFLEX R 32,5 MM | m | R$ 46.3500 | ITERMIL | Isolamento Especial\n[Isolamento] 1\" - ARMAFLEX T 45 MM | m | R$ 70.9200 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1\" - ARMAFLEX T 45 MM | m | R$ 70.9200 | ITERMIL | Isolamento Especial\n[Isolamento] 1\" – SA H/M 025/028 | 20.15 | R$ 41.0000 | 1\" – SA H/M 025/028 | Isolamento Especial\n[Isolamento] 1\" – SA R/T 025/028 | 20.15 | R$ 46.0000 | 1\" – SA R/T 025/028 | Isolamento Especial\n[Isolamento] 1/2\" - ARMAFLEX H 13 MM | m | R$ 11.3000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1/2\" - ARMAFLEX H 13 MM | m | R$ 11.3000 | ITERMIL | Isolamento Padrão\n[Isolamento] 1/2\" - ARMAFLEX M 19 MM | m | R$ 20.0000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1/2\" - ARMAFLEX M 19 MM | m | R$ 20.0000 | ITERMIL | Isolamento Especial\n[Isolamento] 1/2\" - ARMAFLEX M 19 MM | m | R$ 20.0000 | ITERMIL | Isolamento Padrão\n[Isolamento] 1/2\" - ARMAFLEX R 32,5 MM | m | R$ 35.0900 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1/2\" - ARMAFLEX R 32,5 MM | m | R$ 35.0900 | ITERMIL | Isolamento Especial\n[Isolamento] 1/2\" - ARMAFLEX T 45 MM | m | R$ 43.1700 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1/2\" - ARMAFLEX T 45 MM | m | R$ 43.1700 | Intermil 11/05/2026 | Isolamento Especial\n[Isolamento] 1/2\" – SA H/M 012/015 | 11.45 | R$ 37.0000 | 1/2\" – SA H/M 012/015 | Isolamento Especial\n[Isolamento] 1/2\" – SA R/T 012/015 | 11.45 | R$ 41.0000 | 1/2\" – SA R/T 012/015 | Isolamento Especial\n[Isolamento] 1/4\" - ARMAFLEX H 13 MM | m | R$ 9.7000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1/4\" - ARMAFLEX H 13 MM | m | R$ 9.7000 | ITERMIL | Isolamento Especial\n[Isolamento] 1/4\" - ARMAFLEX H 13 MM | m | R$ 9.7000 | ITERMIL | Isolamento Padrão\n[Isolamento] 1/4\" - ARMAFLEX M 19 MM | m | R$ 16.8300 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1/4\" - ARMAFLEX M 19 MM | m | R$ 16.8300 | ITERMIL | Isolamento Especial\n[Isolamento] 1/4\" - ARMAFLEX M 19 MM | m | R$ 16.8300 | ITERMIL | Isolamento Padrão\n[Isolamento] 1/4\" - ARMAFLEX R 32,5 MM | m | R$ 22.3600 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1/4\" - ARMAFLEX R 32,5 MM | m | R$ 22.3600 | ITERMIL | Isolamento Especial\n[Isolamento] 1/4\" - ARMAFLEX T 45 MM | m | R$ 35.5100 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 1/4\" - ARMAFLEX T 45 MM | m | R$ 35.5100 | Não existe essa Bitola | Isolamento Especial\n[Isolamento] 1/4\" – SA H/M 006/010 | 11.45 | R$ 36.5000 | 1/4\" – SA H/M 006/010 | Isolamento Especial\n[Isolamento] 1/4\" – SA R/T 006/010 | 11.45 | R$ 40.0000 | 1/4\" – SA R/T 006/010 | Isolamento Especial\n[Isolamento] 2 1/8\" - ARMAFLEX H 13 MM | m | R$ 33.2000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 2 1/8\" - ARMAFLEX H 13 MM | m | R$ 33.2000 | ITERMIL | Isolamento Padrão\n[Isolamento] 2 1/8\" - ARMAFLEX M 19 MM | m | R$ 55.4300 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 2 1/8\" - ARMAFLEX M 19 MM | m | R$ 55.4300 | ITERMIL | Isolamento Padrão\n[Isolamento] 2 1/8\" - ARMAFLEX R 32,5 MM | m | R$ 85.9300 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 2 1/8\" - ARMAFLEX R 32,5 MM | m | R$ 85.9300 | ITERMIL | Isolamento Especial\n[Isolamento] 2 1/8\" - ARMAFLEX T 45 MM | m | R$ 122.7600 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 2 1/8\" - ARMAFLEX T 45 MM | m | R$ 122.7600 | ITERMIL | Isolamento Especial\n[Isolamento] 2 1/8\" – SA H/M 054/054 | 49.45 | R$ 53.0000 | 2 1/8\" – SA H/M 054/054 | Isolamento Especial\n[Isolamento] 2 1/8\" – SA R/T 054/054 | 49.45 | R$ 60.5000 | 2 1/8\" – SA R/T 054/054 | Isolamento Especial\n[Isolamento] 3/4\" - ARMAFLEX H 13 MM | m | R$ 13.7000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 3/4\" - ARMAFLEX H 13 MM | m | R$ 13.7000 | ITERMIL | Isolamento Padrão\n[Isolamento] 3/4\" - ARMAFLEX M 19 MM | m | R$ 22.6800 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 3/4\" - ARMAFLEX M 19 MM | m | R$ 22.6800 | ITERMIL | Isolamento Especial\n[Isolamento] 3/4\" - ARMAFLEX M 19 MM | m | R$ 22.6800 | ITERMIL | Isolamento Padrão\n[Isolamento] 3/4\" - ARMAFLEX R 32,5 MM | m | R$ 41.4900 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 3/4\" - ARMAFLEX R 32,5 MM | m | R$ 41.4900 | ITERMIL | Isolamento Especial\n[Isolamento] 3/4\" - ARMAFLEX T 45 MM | m | R$ 60.9900 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 3/4\" - ARMAFLEX T 45 MM | m | R$ 60.9900 | ITERMIL | Isolamento Especial\n[Isolamento] 3/4\" – SA H/M 018/022 | 14.75 | R$ 39.5000 | 3/4\" – SA H/M 018/022 | Isolamento Especial\n[Isolamento] 3/4\" – SA R/T 018/022 | 14.75 | R$ 45.0000 | 3/4\" – SA R/T 018/022 | Isolamento Especial\n[Isolamento] 3/8\" - ARMAFLEX H 13 MM | m | R$ 10.7000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 3/8\" - ARMAFLEX H 13 MM | m | R$ 10.7000 | ITERMIL | Isolamento Especial\n[Isolamento] 3/8\" - ARMAFLEX H 13 MM | m | R$ 10.7000 | ITERMIL | Isolamento Padrão\n[Isolamento] 3/8\" - ARMAFLEX M 19 MM | m | R$ 18.9700 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 3/8\" - ARMAFLEX M 19 MM | m | R$ 18.9700 | ITERMIL | Isolamento Especial\n[Isolamento] 3/8\" - ARMAFLEX M 19 MM | m | R$ 18.9700 | ITERMIL | Isolamento Padrão\n[Isolamento] 3/8\" - ARMAFLEX R 32,5 MM | m | R$ 22.3600 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 3/8\" - ARMAFLEX R 32,5 MM | m | R$ 22.3600 | ITERMIL | Isolamento Especial\n[Isolamento] 3/8\" - ARMAFLEX T 45 MM | m | R$ 35.5100 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 3/8\" - ARMAFLEX T 45 MM | m | R$ 35.5100 | Intermil 11/05/2026 | Isolamento Especial\n[Isolamento] 3/8\" – SA H/M 006/010 | 11.45 | R$ 36.5000 | 3/8\" – SA H/M 006/010 | Isolamento Especial\n[Isolamento] 3/8\" – SA R/T 006/010 | 11.45 | R$ 40.0000 | 3/8\" – SA R/T 006/010 | Isolamento Especial\n[Isolamento] 5/8\" - ARMAFLEX H 13 MM | m | R$ 12.6000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 5/8\" - ARMAFLEX H 13 MM | m | R$ 12.6000 | ITERMIL | Isolamento Padrão\n[Isolamento] 5/8\" - ARMAFLEX M 19 MM | m | R$ 21.1400 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 5/8\" - ARMAFLEX M 19 MM | m | R$ 21.1400 | ITERMIL | Isolamento Especial\n[Isolamento] 5/8\" - ARMAFLEX M 19 MM | m | R$ 21.1400 | ITERMIL | Isolamento Padrão\n[Isolamento] 5/8\" - ARMAFLEX R 32,5 MM | m | R$ 37.4600 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 5/8\" - ARMAFLEX R 32,5 MM | m | R$ 37.4600 | ITERMIL | Isolamento Especial\n[Isolamento] 5/8\" - ARMAFLEX T 45 MM | m | R$ 55.8700 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 5/8\" - ARMAFLEX T 45 MM | m | R$ 55.8700 | ITERMIL | Isolamento Especial\n[Isolamento] 5/8\" – SA H/M 012/015 | 14.75 | R$ 37.0000 | 5/8\" – SA H/M 012/015 | Isolamento Especial\n[Isolamento] 5/8\" – SA R/T 012/015 | 14.75 | R$ 41.0000 | 5/8\" – SA R/T 012/015 | Isolamento Especial\n[Isolamento] 7/8\" - ARMAFLEX H 13 MM | m | R$ 14.8000 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 7/8\" - ARMAFLEX H 13 MM | m | R$ 14.8000 | ITERMIL | Isolamento Padrão\n[Isolamento] 7/8\" - ARMAFLEX R 32,5 MM | m | R$ 44.0700 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 7/8\" - ARMAFLEX R 32,5 MM | m | R$ 44.0700 | ITERMIL | Isolamento Especial\n[Isolamento] 7/8\" - ARMAFLEX T 45 MM | m | R$ 64.8900 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 7/8\" - ARMAFLEX T 45 MM | m | R$ 64.8900 | ITERMIL | Isolamento Especial\n[Isolamento] 7/8\" – SA H/M 018/022 | 20.15 | R$ 39.5000 | 7/8\" – SA H/M 018/022 | Isolamento Especial\n[Isolamento] 7/8\" – SA R/T 018/022 | 20.15 | R$ 45.0000 | 7/8\" – SA R/T 018/022 | Isolamento Especial\n[Isolamento] 7/8\"- ARMAFLEX M 19 MM | m | R$ 26.4400 | Intermil 03/06/2026 | AC - DIRETA - COBRE\n[Isolamento] 7/8\"- ARMAFLEX M 19 MM | m | R$ 26.4400 | ITERMIL | Isolamento Especial\n[Isolamento] 7/8\"- ARMAFLEX M 19 MM | m | R$ 26.4400 | ITERMIL | Isolamento Padrão\n[Isolamento] Adesivo Armaflex 520 - 900ml | unid. | R$ 115.4700 | - | AC - DIRETA - COBRE\n[Isolamento] Adesivo Armaflex 520 - 900ml | unid. | R$ 120.0000 | 08/05/2024 | AC - DIRETA - COBRE\n[Isolamento] ALTERNATIVA: Válvula de Balanceamento e Controle 2 vias indep. Pressão 1 1/2\" | - | R$ 3243.5200 | - | AC - INDIRETA - AGUA\n[Isolamento] ALTERNATIVA: Válvula de Balanceamento e Controle 2 vias indep. Pressão 1 1/4\" | - | R$ 2480.2800 | - | AC - INDIRETA - AGUA\n[Isolamento] ALTERNATIVA: Válvula de Balanceamento e Controle 2 vias indep. Pressão 2 1/2\" | - | R$ 6408.5600 | - | AC - INDIRETA - AGUA\n[Isolamento] ALTERNATIVA: Válvula de Balanceamento e Controle 2 vias indep. Pressão 2\" | - | R$ 4589.8600 | - | AC - INDIRETA - AGUA\n[Isolamento] ALTERNATIVA: Válvula de Balanceamento e Controle 2 vias indep. Pressão 3\" | - | R$ 9596.8000 | - | AC - INDIRETA - AGUA\n[Isolamento] Dutos Flexivéis - 100 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 04\" | pç | R$ 105.0000 | ITERMIL - 03/07/26 | EX_AE\n[Isolamento] Dutos Flexivéis - 100 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 04\" | pç | R$ 105.0000 | ITERMIL - 03/07/26 | Pressurização\n[Isolamento] Dutos Flexivéis - 150 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 06\" | pç | R$ 143.0000 | ITERMIL - 03/07/26 | EX_AE\n[Isolamento] Dutos Flexivéis - 150 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 06\" | pç | R$ 143.0000 | ITERMIL - 03/07/26 | Pressurização\n[Isolamento] Dutos Flexivéis - 200 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 08\" | pç | R$ 186.0000 | ITERMIL - 03/07/26 | EX_AE\n[Isolamento] Dutos Flexivéis - 200 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 08\" | pç | R$ 186.0000 | ITERMIL - 03/07/26 | Pressurização\n[Isolamento] Dutos Flexivéis - 250 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 10\" | pç | R$ 228.0000 | ITERMIL - 03/07/26 | EX_AE\n[Isolamento] Dutos Flexivéis - 250 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 10\" | pç | R$ 228.0000 | ITERMIL - 03/07/26 | Pressurização\n[Isolamento] Dutos Flexivéis - 300 mm (unid c/ 10m) - SEM ISOLAMENTO - ALUDEC 12\" | pç | R$ 287.0000 | ITERMIL - 03/07/26 | EX_AE\n[Isolamento] Dutos Flexivéis - 300 mm (unid c/ 10m) - SEM ISOLAMENTO - ALUDEC 12\" | pç | R$ 287.0000 | ITERMIL - 03/07/26 | Pressurização\n[Isolamento] Espuma Polietileno Expandido - 1\" - (ISOTUBO) | m | R$ 3.9700 | FrioPeças - 07/05/2026 | AC - DIRETA - COBRE\n[Isolamento] Espuma Polietileno Expandido - 1\" - (ISOTUBO) | m | R$ 3.9700 | Dufrio - 07/05/2026 | Isolamento Padrão\n[Isolamento] Espuma Polietileno Expandido - 1/2\" - (ISOTUBO) | m | R$ 1.9800 | Dufrio - 07/05/2026 - Preço de Faturamento direto | AC - DIRETA - COBRE\n[Isolamento] Espuma Polietileno Expandido - 1/2\" - (ISOTUBO) | m | R$ 1.9800 | Dufrio - 07/05/2026 | Isolamento Padrão\n[Isolamento] Espuma Polietileno Expandido - 1/4\" - (ISOTUBO) | m | R$ 1.8100 | Dufrio - 07/05/2026 | AC - DIRETA - COBRE\n[Isolamento] Espuma Polietileno Expandido - 1/4\" - (ISOTUBO) | m | R$ 1.8100 | Dufrio - 07/05/2026 | Isolamento Padrão\n[Isolamento] Espuma Polietileno Expandido - 1/4\" - 10x6,4mm (ISOTUBO) | m | R$ 1.8100 | Dufrio - 07/05/2026 | AC - DIRETA - COBRE\n[Isolamento] Espuma Polietileno Expandido - 1/4\" - 10x6,4mm (ISOTUBO) | m | R$ 1.8100 | Dufrio - 07/05/2026 | Isolamento Padrão\n[Isolamento] Espuma Polietileno Expandido - 3/4\" - (ISOTUBO) | m | R$ 2.6000 | Dufrio - 07/05/2026 | AC - DIRETA - COBRE\n[Isolamento] Espuma Polietileno Expandido - 3/4\" - (ISOTUBO) | m | R$ 2.6000 | Dufrio - 07/05/2026 | Isolamento Padrão\n[Isolamento] Espuma Polietileno Expandido - 3/8\" - (ISOTUBO) | m | R$ 1.8000 | Dufrio - 07/05/2026 | AC - DIRETA - COBRE\n[Isolamento] Espuma Polietileno Expandido - 3/8\" - (ISOTUBO) | m | R$ 1.8000 | Dufrio - 07/05/2026 | Isolamento Padrão\n[Isolamento] Espuma Polietileno Expandido - 3/8\" - 10x10mm (ISOTUBO) | m | R$ 1.8000 | Dufrio - 07/05/2026 | AC - DIRETA - COBRE\n[Isolamento] Espuma Polietileno Expandido - 3/8\" - 10x10mm (ISOTUBO) | m | R$ 1.8000 | Dufrio - 07/05/2026 | Isolamento Padrão\n[Isolamento] Espuma Polietileno Expandido - 5/8\" - (ISOTUBO) | m | R$ 2.9500 | Dufrio - 07/05/2026 | AC - DIRETA - COBRE\n[Isolamento] Espuma Polietileno Expandido - 5/8\" - (ISOTUBO) | m | R$ 2.9500 | Dufrio - 07/05/2026 | Isolamento Padrão\n[Isolamento] Espuma Polietileno Expandido - 7/8\" - (ISOTUBO) | m | R$ 3.6900 | FrioPeças - 07/05/2026 | AC - DIRETA - COBRE\n[Isolamento] Espuma Polietileno Expandido - 7/8\" - (ISOTUBO) | m | R$ 3.6900 | Dufrio - 07/05/2026 | Isolamento Padrão\n[Isolamento] Espuma Polietileno Expandido- 1 1/8\" - (ISOTUBO) | m | R$ 3.5700 | FrioPeças - 07/05/2026 | AC - DIRETA - COBRE\n[Isolamento] Espuma Polietileno Expandido- 1 1/8\" - (ISOTUBO) | m | R$ 3.5700 | Dufrio - 07/05/2026 | Isolamento Padrão\n[Isolamento] Fita Armaflex m | unid. | R$ 93.3300 | - | AC - DIRETA - COBRE\n[Isolamento] Fita Armaflex m - Rolo c/ 15 metros | unid. | R$ 95.0000 | 08/05/2023 | AC - DIRETA - COBRE\n[Isolamento] Isolamento Armaduct - Espuma Elastomérica - 10mm | m² | R$ 230.0000 | Itermil 17/07/26 | AC - DIRETA - COBRE\n[Isolamento] Isolamento Armaduct - Espuma Elastomérica - 10mm | m² | R$ 130.0000 | Itermil 17/07/26 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Fibra Cerâmica - 38 mm - 96 kg/m3 - 3,05m² (Caso seja solicitado camada dupla, multiplicar por 2) | m² | R$ 130.5000 | Itermil 20-07-26 | EX Cozinha\n[Isolamento] Isolamento Fibra Cerâmica - 38 mm - 96 kg/m3 - 3,05m² (Caso seja solicitado camada dupla, multiplicar por 2) | m² | R$ 130.5000 | Itermil 20-07-26 | EX_AE\n[Isolamento] Isolamento Fibra Cerâmica - 38 mm - 96 kg/m3 - 3,05m² (Caso seja solicitado camada dupla, multiplicar por 2) | m² | R$ 130.5000 | Itermil 20-07-26 | Pressurização\n[Isolamento] Isolamento Flexliner - 25mm | m² | R$ 80.0000 | --- | AC - DIRETA - COBRE\n[Isolamento] Isolamento Flexliner - 25mm | m² | R$ 80.0000 | 03/07/2026 Refrin | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Lã de Rocha - 50mm - 32KG - 9,6m²(Caso seja solicitado camada dupla, multiplicar por 2) | m² | R$ 37.0000 | Itermil 20-07-26 | EX Cozinha\n[Isolamento] Isolamento Lã de Rocha - 50mm - 32KG - 9,6m²(Caso seja solicitado camada dupla, multiplicar por 2) | m² | R$ 37.0000 | Itermil 20-07-26 | EX_AE\n[Isolamento] Isolamento Lã de Rocha - 50mm - 32KG - 9,6m²(Caso seja solicitado camada dupla, multiplicar por 2) | m² | R$ 37.0000 | Itermil 20-07-26 | Pressurização\n[Isolamento] Isolamento Lã de vidro - 38mm | m² | R$ 25.0000 | Itermil 17/07/26 | AC - DIRETA - COBRE\n[Isolamento] Isolamento Lã de vidro - 38mm | m² | R$ 25.0000 | Itermil 17/07/26 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Manta Armaflex 32mm (Tubulações acima de 8\") | m² | R$ 200.4010 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Polipex - 10mm | m² | R$ 85.0000 | Itermil 17/07/26 | AC - DIRETA - COBRE\n[Isolamento] Isolamento Polipex - 10mm | m² | R$ 100.0000 | Itermil 17/07/26 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Polipex - 15mm | m² | R$ 135.0000 | Itermil 17/07/26 | AC - DIRETA - COBRE\n[Isolamento] Isolamento Polipex - 15mm | m² | R$ 145.0000 | Itermil 17/07/26 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Tubulação Armaflex - 1 1/2\" - AF-T-48 | m | R$ 114.4300 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Tubulação Armaflex - 1 1/4\" - AF-T-42 | m | R$ 102.5900 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Tubulação Armaflex - 1\" - AF-T-35 | m | R$ 88.1400 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Tubulação Armaflex - 2 1/2\" -AF-T-76 | m | R$ 168.4400 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Tubulação Armaflex - 2\" - AF-T-60 | m | R$ 135.6000 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Tubulação Armaflex - 3\" - AF-T-89 | m | R$ 190.6000 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Tubulação Armaflex - 3/4\" - AF-T-28 | m | R$ 75.7900 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Tubulação Armaflex - 4\" - AF-T-114 | m | R$ 235.2900 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Tubulação Armaflex - 5\" - AF-T-140 | m | R$ 285.5300 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Isolamento] Isolamento Tubulação Armaflex - 6\" AF-T-168 | m | R$ 338.7800 | Armacell - 2026 | AC - INDIRETA - AGUA\n[Isolamento] Porca e arruela de 1/4 pol. | pç | R$ 0.1800 | 01/07/2026 | AC - DIRETA - COBRE\n[Isolamento] Porca e arruela de 1/4 pol. | pç | R$ 0.1800 | 01/07/2026 | AC - INDIRETA - AGUA\n[Isolamento] Porca e arruela de 1/4 pol. | pç | R$ 0.1800 | 01/07/2026 | EX Cozinha\n[Isolamento] Porca e arruela de 1/4 pol. | pç | R$ 0.1800 | 01/07/2026 | EX_AE\n[Isolamento] Porca e arruela de 1/4 pol. | pç | R$ 0.3000 | - | Pressurização\n[Isolamento] Porca e arruela de 5/16 pol. | pç | R$ 0.3000 | 01/07/2026 | AC - DIRETA - COBRE\n[Isolamento] Porca e arruela de 5/16 pol. | pç | R$ 0.3000 | 01/07/2026 | AC - INDIRETA - AGUA\n[Isolamento] Porca e arruela de 5/16 pol. | pç | R$ 0.3000 | 01/07/2026 | EX Cozinha\n[Isolamento] Porca e arruela de 5/16 pol. | pç | R$ 0.3000 | 01/07/2026 | EX_AE\n[Isolamento] Porca e arruela de 5/16 pol. | pç | R$ 0.3500 | - | Pressurização\n[Isolamento] Válvula de balanceamento - 5\" | unid | R$ 10721.9000 | - | AC - INDIRETA - AGUA\n[Isolamento] Válvula de balanceamento - 6\" | unid | R$ 5576.0200 | By Import - 03-07-2026 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de balanceamento - 6\" | unid | R$ 15835.6000 | - | AC - INDIRETA - AGUA\n[Isolamento] Válvula de balanceamento do diâmetro | Unid. | R$ 436.3100 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de balanceamento do diâmetro | Unid. | R$ 487.5700 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de balanceamento do diâmetro - 1 1/2\" | - | R$ 511.2700 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de balanceamento do diâmetro - 1 1/4\" | - | R$ 482.0200 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de balanceamento do diâmetro - 2 1/2\" | - | R$ 1815.6900 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de balanceamento do diâmetro - 2\" | - | R$ 1134.6400 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de balanceamento do diâmetro - 3\" | - | R$ 3345.5900 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de bloqueio - 5\" - Valvula Gaveta, Aço Carbono com flange 5\" | unid | R$ 5491.2000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de bloqueio - 6\" - Valvula Gaveta, Aço Carbono com flange 6\" | unid | R$ 6858.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de Bloqueio Tipo Esfera 1\" | Unid. | R$ 58.0000 | - | AC - INDIRETA - AGUA\n[Isolamento] Válvula de Bloqueio Tipo Esfera 3/4\" | Unid. | R$ 27.0000 | - | AC - INDIRETA - AGUA\n[Isolamento] Válvula de controle 2 vias com atuador e termostato do diâmetro - 1 1/2\" | - | R$ 2660.6100 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de controle 2 vias com atuador e termostato do diâmetro - 1 1/4\" | - | R$ 2108.4400 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de controle 2 vias com atuador e termostato do diâmetro - 2 1/2\" | - | R$ 4164.0800 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de controle 2 vias com atuador e termostato do diâmetro - 2\" | - | R$ 2760.9100 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de controle 2 vias com atuador e termostato do diâmetro - 3\" | - | R$ 4592.7500 | BY IMPORT 03/04/23 | AC - INDIRETA - AGUA\n[Isolamento] Válvula de retenção dupla portinhola, wafer flangeada - 5\" | unid | R$ 1374.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Linha frigorígena] 1 1/2\" – 38,1mm – e=1/16\" tubulação de cobre RÍGIDO | m | R$ 252.8050 | - | AC - DIRETA - COBRE\n[Linha frigorígena] 1 1/4\" – 31,75mm – e=1/16\" tubulação de cobre RÍGIDO | m | R$ 208.7850 | - | AC - DIRETA - COBRE\n[Linha frigorígena] 1 1/8\" – 28,6mm – e=1/16\" tubulação de cobre RÍGIDO | m | R$ 186.7750 | - | AC - DIRETA - COBRE\n[Linha frigorígena] 1 3/8\" – 34,9mm – e=1/16\" tubulação de cobre RÍGIDO | m | R$ 230.7950 | - | AC - DIRETA - COBRE\n[Linha frigorígena] 1 5/8\" – 41,3mm – e=1/16\" tubulação de cobre RÍGIDO | m | R$ 274.3500 | - | AC - DIRETA - COBRE\n[Linha frigorígena] 1\" – 25,4mm – e=1/16\" tubulação de cobre RÍGIDO | m | R$ 164.9200 | - | AC - DIRETA - COBRE\n[Linha frigorígena] 1.3/4\" – 44,45mm – e=1/16\" tubulação de cobre RÍGIDO | m | R$ 296.6700 | - | AC - DIRETA - COBRE\n[Linha frigorígena] 1/2\" – 12,7mm – e=1/32\" tubulação de cobre FLEXIVÉL | m | R$ 67.0950 | - | AC - DIRETA - COBRE\n[Linha frigorígena] 1/4\" - 6,35mm – e= 1/32\" tubulação de cobre FLEXIVÉL | m | R$ 28.7550 | - | AC - DIRETA - COBRE\n[Linha frigorígena] 3/4\" – 19,05mm – e=1/16\" tubulação de cobre RÍGIDO | m | R$ 120.9000 | - | AC - DIRETA - COBRE\n[Linha frigorígena] 3/8\" – 9,53mm – e=1/32\" tubulação de cobre FLEXIVEL | m | R$ 47.9250 | - | AC - DIRETA - COBRE\n[Linha frigorígena] 5/8\" – 15,88mm – e=1/16\" tubulação de cobre FLEXIVÉL/RÍGIDO | m | R$ 86.1300 | - | AC - DIRETA - COBRE\n[Linha frigorígena] 7/8\" - 22,2mm – e=1/16\" tubulação de cobre RÍGIDO | m | R$ 142.9100 | - | AC - DIRETA - COBRE\n[Linha frigorígena] CABINHO PP 4x2,5mm² | m | R$ 13.3745 | 11/05/2026 | AC - DIRETA - COBRE\n[Linha frigorígena] Capacidade Total das Evaporadoras (HP) — Utilizado na Ausência de Caminhamento de cobre | HP | R$ 2800.0000 | - | AC - DIRETA - COBRE\n[Linha frigorígena] Cobre flexível | kg | R$ 135.0000 | 04/05/2026 | AC - DIRETA - COBRE\n[Linha frigorígena] Cobre rígido | kg | R$ 155.0000 | 04/05/2026 | AC - DIRETA - COBRE\n[Linha frigorígena] FITA PVC BRANCA - Rolo | m | R$ 3.5190 | 11/05/2026 | AC - DIRETA - COBRE\n[Linha frigorígena] Refrigerante (Garrafa 11KG) - DUPOINT | pç | R$ 1600.0000 | 08/05/2026 | AC - DIRETA - COBRE\n[Linha frigorígena] Refrigerante (Garrafa 11KG) - DUPOINT | pç | R$ 1600.0000 | - | AC - DIRETA - COBRE\n[Linha frigorígena] Refrigerante R410 (Garrafa 11KG) (Ver no catálogo do fabricante) | VB | R$ 1600.0000 | 08/05/2026 | AC - DIRETA - COBRE\n[Linha frigorígena] Tubulação de Cobre - 1 1/8\" Rígido -1/32\" | m | R$ 186.7750 | - | AC - DIRETA - COBRE\n[Linha frigorígena] Tubulação de Cobre - 1\" Rígido - 1/32\" | m | R$ 164.9200 | - | AC - DIRETA - COBRE\n[Linha frigorígena] Tubulação de Cobre - 1/2\" - 1/32\" | m | R$ 35.9100 | - | AC - DIRETA - COBRE\n[Linha frigorígena] Tubulação de Cobre - 1/4\" - 1/32\" | m | R$ 16.7400 | - | AC - DIRETA - COBRE\n[Linha frigorígena] Tubulação de Cobre - 3/4\" Rígido - 1/32\" | m | R$ 120.9000 | - | AC - DIRETA - COBRE\n[Linha frigorígena] Tubulação de Cobre - 3/8\" - 1/32\" | m | R$ 26.3250 | - | AC - DIRETA - COBRE\n[Linha frigorígena] Tubulação de Cobre - 5/8\" - 1/32\" | m | R$ 45.4950 | - | AC - DIRETA - COBRE\n[Linha frigorígena] Tubulação de Cobre - 7/8\" Rígido - 1/32\" | m | R$ 142.9100 | - | AC - DIRETA - COBRE\n[Linha frigorígena] Tubulação de Cobre Flexivel - 1/4\" - 1/32\" | m | R$ 16.7400 | - | AC - DIRETA - COBRE\n[Linha frigorígena] Tubulação de Cobre Flexível | - | R$ 135.0000 | 30/06/2026 - DUFRIO | AC - DIRETA - COBRE\n[Linha frigorígena] Tubulação de Cobre Flexível | kg | R$ 135.0000 | 04/05/2026 | AC - DIRETA - COBRE\n[Linha frigorígena] Tubulação de Cobre Rígido | - | R$ 155.0000 | 30/06/2026 - DUFRIO | AC - DIRETA - COBRE\n[Linha frigorígena] Tubulação de Cobre Rígido | kg | R$ 155.0000 | 04/05/2026 | AC - DIRETA - COBRE\n[Mão de obra] Duteiro (fabricação e montagem) | m² | R$ 100.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] Duteiro (fabricação e montagem) | m linear | R$ 150.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] Duteiro (fabricação e montagem) | m² | R$ 100.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] Duteiro (fabricação e montagem) | m linear | R$ 150.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] Duteiro (Fabricação) - Exaustão e Ventilação | KG | R$ 4.0000 | --- | EX Cozinha\n[Mão de obra] Duteiro (Fabricação) - Exaustão e Ventilação | KG | R$ 4.0000 | --- | EX_AE\n[Mão de obra] Duteiro (Fabricação) - Exaustão e Ventilação | KG | R$ 4.0000 | --- | Pressurização\n[Mão de obra] Duteiro (Fabricação) - Insuflamento e Retorno | KG | R$ 4.0000 | --- | AC - DIRETA - COBRE\n[Mão de obra] Duteiro (Fabricação) - Insuflamento e Retorno | KG | R$ 4.0000 | --- | AC - INDIRETA - AGUA\n[Mão de obra] Duteiro (Instalação) - Exaustão e Ventilação | KG | R$ 15.0000 | --- | EX Cozinha\n[Mão de obra] Duteiro (Instalação) - Exaustão e Ventilação | KG | R$ 15.0000 | --- | EX_AE\n[Mão de obra] Duteiro (Instalação) - Exaustão e Ventilação | KG | R$ 18.0000 | --- | Pressurização\n[Mão de obra] Duteiro (Instalação) - Insuflamento e Retorno | KG | R$ 15.0000 | --- | AC - DIRETA - COBRE\n[Mão de obra] Duteiro (Instalação) - Insuflamento e Retorno | KG | R$ 15.0000 | --- | AC - INDIRETA - AGUA\n[Mão de obra] Duteiro + Soldador (Fabricação) - Exaustão Chapa Preta | KG | R$ 8.0000 | --- | EX Cozinha\n[Mão de obra] Duteiro + Soldador (Fabricação) - Exaustão Chapa Preta | KG | R$ 8.0000 | --- | Pressurização\n[Mão de obra] Duteiro + Soldador (Instalação) - Exaustão Chapa Preta | KG | R$ 20.0000 | --- | EX Cozinha\n[Mão de obra] Duteiro + Soldador (Instalação) - Exaustão Chapa Preta | KG | R$ 20.0000 | --- | Pressurização\n[Mão de obra] Duteiros - Preço Fixo Caso seja pouco duto | vb | R$ 6000.0000 | --- | EX Cozinha\n[Mão de obra] Duteiros - Preço Fixo Caso seja pouco duto | vb | R$ 8000.0000 | - | EX Cozinha\n[Mão de obra] Duteiros - Preço Fixo Caso seja pouco duto | vb | R$ 8000.0000 | --- | EX_AE\n[Mão de obra] Duteiros - Preço Fixo Caso seja pouco duto | vb | R$ 8000.0000 | - | Pressurização\n[Mão de obra] Duteiros - Preço Fixo Caso seja pouco duto | vb | R$ 8000.0000 | --- | Pressurização\n[Mão de obra] Duteiros - Preço Fixo Caso seja pouco duto - abaixo de 200 KG | vb | R$ 8000.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] Duteiros - Preço Fixo Caso seja pouco duto - abaixo de 200 KG | vb | R$ 8000.0000 | --- | AC - INDIRETA - AGUA\n[Mão de obra] Horario Comercial | 09.000 a 12.000 Btu/h | unid | R$ 630.0000 | - | AC Direta - tabela simplificada\n[Mão de obra] Horario Comercial | 18.000 a 22.000 Btu/h | unid | R$ 840.0000 | - | AC Direta - tabela simplificada\n[Mão de obra] Horario Comercial | 30.000 a 36.000 Btu/h | unid | R$ 980.0000 | - | AC Direta - tabela simplificada\n[Mão de obra] Horario Comercial | 48.000 a 60.000 Btu/h | unid | R$ 1120.0000 | - | AC Direta - tabela simplificada\n[Mão de obra] Horario Comercial | Built In | 09.000 a 12.000 Btu/h | unid | R$ 1400.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Comercial | Built In | 18.000 a 22.000 Btu/h | unid | R$ 1600.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Comercial | Built In | 30.000 a 36.000 Btu/h | unid | R$ 1800.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Comercial | Built In | 48.000 a 60.000 Btu/h | unid | R$ 2000.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Comercial | Cassete | 09.000 a 12.000 Btu/h | unid | R$ 1200.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Comercial | Cassete | 18.000 a 22.000 Btu/h | unid | R$ 1400.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Comercial | Cassete | 30.000 a 36.000 Btu/h | unid | R$ 1600.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Comercial | Cassete | 48.000 a 60.000 Btu/h | unid | R$ 1800.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Comercial | Hi Wall | 09.000 a 12.000 Btu/h | unid | R$ 900.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Comercial | Hi Wall | 18.000 a 22.000 Btu/h | unid | R$ 1200.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Comercial | Piso Teto | 30.000 a 36.000 Btu/h | unid | R$ 1400.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Comercial | Piso Teto | 48.000 a 60.000 Btu/h | unid | R$ 1600.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Extra | 09.000 a 12.000 Btu/h | unid | R$ 787.5000 | - | AC Direta - tabela simplificada\n[Mão de obra] Horario Extra | 18.000 a 22.000 Btu/h | unid | R$ 1050.0000 | - | AC Direta - tabela simplificada\n[Mão de obra] Horario Extra | 30.000 a 36.000 Btu/h | unid | R$ 1225.0000 | - | AC Direta - tabela simplificada\n[Mão de obra] Horario Extra | 48.000 a 60.000 Btu/h | unid | R$ 1400.0000 | - | AC Direta - tabela simplificada\n[Mão de obra] Horario Extra | Built In | 09.000 a 12.000 Btu/h | unid | R$ 1750.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Extra | Built In | 18.000 a 22.000 Btu/h | unid | R$ 2000.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Extra | Built In | 30.000 a 36.000 Btu/h | unid | R$ 2250.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Extra | Built In | 48.000 a 60.000 Btu/h | unid | R$ 2500.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Extra | Cassete | 09.000 a 12.000 Btu/h | unid | R$ 1500.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Extra | Cassete | 18.000 a 22.000 Btu/h | unid | R$ 1750.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Extra | Cassete | 30.000 a 36.000 Btu/h | unid | R$ 2000.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Extra | Cassete | 48.000 a 60.000 Btu/h | unid | R$ 2250.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Extra | Hi Wall | 09.000 a 12.000 Btu/h | unid | R$ 1125.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Extra | Hi Wall | 18.000 a 22.000 Btu/h | unid | R$ 1500.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Extra | Piso Teto | 30.000 a 36.000 Btu/h | unid | R$ 1750.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Horario Extra | Piso Teto | 48.000 a 60.000 Btu/h | unid | R$ 2000.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] M.O - Cortina de Ar | unid | R$ 800.0000 | 29/12/25 | AC - DIRETA - COBRE\n[Mão de obra] M.O - Fechamento Hidráulico - 1 1/2\" | unid | R$ 1200.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Fechamento Hidráulico - 1 1/4\" | unid | R$ 1200.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Fechamento Hidráulico - 2 1/2\" | unid | R$ 1200.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Fechamento Hidráulico - 2\" | unid | R$ 1200.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Fechamento Hidráulico - 3\" | unid | R$ 1200.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Fechamento Hidráulico - Bomba | unid | R$ 5000.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Fechamento Hidráulico - Chiller | unid | R$ 5000.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Fechamento Hidráulico - Torre | unid | R$ 5000.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Fechamento Hidráulico Fancolete | Unid. | R$ 600.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Proteção Mecânica - Aluminio 0,7 mm | m linear | R$ 80.0000 | JUVENAL | AC - DIRETA - COBRE\n[Mão de obra] M.O - Proteção Mecânica - Aluminio 0,7 mm | m linear | R$ 80.0000 | JUVENAL | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Proteção Mecânica - Aluminio Corrugado 0,40 mm | m linear | R$ 80.0000 | JUVENAL | AC - DIRETA - COBRE\n[Mão de obra] M.O - Proteção Mecânica - Fibraflex - de 2 1/2\" até 3\" | m linear | R$ 90.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Proteção Mecânica - Fibraflex - de 3/4\" até 2\" | m linear | R$ 70.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Tubulação Água Gelada - 2 1/2\" até 3\" | m | R$ 150.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Tubulação Água Gelada - até 10\" | m | R$ 200.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O - Tubulação Água Gelada - até 2\" | m | R$ 120.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O. - Apenas Instalação | kg | R$ 10.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] M.O. - Apenas Instalação | M | R$ 10.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] M.O. - Apenas Instalação | kg | R$ 35.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] M.O. - Apenas Instalação | kg | R$ 10.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O. - Apenas Instalação | M | R$ 10.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] M.O. - Apenas Instalação | M | R$ 10.0000 | - | EX Cozinha\n[Mão de obra] M.O. - Apenas Instalação | M | R$ 10.0000 | - | EX_AE\n[Mão de obra] Mão de obra | unid. | R$ 120.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] Mão de Obra - Apenas instalação do Equipamentos COIFA | unid | R$ 800.0000 | - | EX Cozinha\n[Mão de obra] Mão de Obra - Apenas instalação do Equipamentos COIFA WASH PULL | unid | R$ 2000.0000 | - | EX Cozinha\n[Mão de obra] Mão de Obra - Apenas instalação do Equipamentos EXAUSTOR AXIAIS (ACI, etc) | unid | R$ 1000.0000 | 29-12-25 | EX_AE\n[Mão de obra] Mão de Obra - Apenas instalação do Equipamentos EXAUSTOR/CAIXA VENTILADORA | unid | R$ 1500.0000 | - | EX Cozinha\n[Mão de obra] Mão de Obra - Apenas instalação do Equipamentos EXAUSTOR/CAIXA VENTILADORA | unid | R$ 1500.0000 | 29-12-25 | EX_AE\n[Mão de obra] Mão de Obra - Apenas instalação do Equipamentos EXAUSTOR/CAIXA VENTILADORA | unid | R$ 1500.0000 | - | Pressurização\n[Mão de obra] Mão de Obra - Apenas instalação do Equipamentos FANCOIL 12,5 a 25 TR | unid | R$ 2000.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] Mão de Obra - Apenas instalação do Equipamentos FANCOIL acima 30 TR | unid | R$ 2000.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] Mão de Obra - Apenas instalação do Equipamentos FANCOIL até 10 TR | unid | R$ 1000.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] Mão de Obra - Apenas instalação do Equipamentos FANCOLETE | unid | R$ 800.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] Mão de Obra - Apenas instalação do Equipamentos FILTRO ELETROESTÁTICO | unid | R$ 1500.0000 | - | EX Cozinha\n[Mão de obra] Mão de Obra - Apenas instalação do Equipamentos LAVADOR DE GASES | unid | R$ 1500.0000 | - | EX Cozinha\n[Mão de obra] Mão de obra - Esp. Elastomérica | m² | R$ 50.0000 | --- | AC - DIRETA - COBRE\n[Mão de obra] Mão de obra - Esp. Elastomérica | m² | R$ 50.0000 | --- | AC - INDIRETA - AGUA\n[Mão de obra] Mão de Obra - Instalação de Caixa GSP | unid | R$ 500.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] Mão de Obra - Instalação de Caixa GSP | unid | R$ 500.0000 | - | EX Cozinha\n[Mão de obra] Mão de Obra - Instalação de Caixa GSP | unid | R$ 500.0000 | - | EX_AE\n[Mão de obra] Mão de Obra - Instalação de Caixa GSP | unid | R$ 500.0000 | - | Pressurização\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 01 motor | unid | R$ 1700.0000 | L.J.D 160 | AC - INDIRETA - AGUA\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 01 motor | unid | R$ 1700.0000 | L.J.D 160 | EX Cozinha\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 01 motor | unid | R$ 1700.0000 | L.J.D 160 | EX_AE\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 01 motor | unid | R$ 1700.0000 | L.J.D 160 | Pressurização\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 03 motores | unid | R$ 2800.0000 | L.J.D 160 | AC - INDIRETA - AGUA\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 03 motores | unid | R$ 2800.0000 | L.J.D 160 | EX Cozinha\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 03 motores | unid | R$ 2800.0000 | L.J.D 160 | EX_AE\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 03 motores | unid | R$ 2800.0000 | L.J.D 160 | Pressurização\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 01 motor com inversor | unid | R$ 2300.0000 | L.J.D 160 | AC - INDIRETA - AGUA\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 01 motor com inversor | unid | R$ 2300.0000 | L.J.D 160 | EX Cozinha\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 01 motor com inversor | unid | R$ 2300.0000 | L.J.D 160 | EX_AE\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 01 motor com inversor | unid | R$ 2300.0000 | L.J.D 160 | Pressurização\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 03 motores com inversor | unid | R$ 3000.0000 | L.J.D 160 | AC - INDIRETA - AGUA\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 03 motores com inversor | unid | R$ 3000.0000 | L.J.D 160 | EX Cozinha\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 03 motores com inversor | unid | R$ 3000.0000 | L.J.D 160 | EX_AE\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 03 motores com inversor | unid | R$ 3000.0000 | L.J.D 160 | Pressurização\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 01 motor com inversor | unid | R$ 3500.0000 | L.J.D 160 | AC - INDIRETA - AGUA\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 01 motor com inversor | unid | R$ 3500.0000 | L.J.D 160 | EX Cozinha\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 01 motor com inversor | unid | R$ 3500.0000 | L.J.D 160 | EX_AE\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 01 motor com inversor | unid | R$ 3500.0000 | L.J.D 160 | Pressurização\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 03 motores com inversor | unid | R$ 4500.0000 | L.J.D 160 | AC - INDIRETA - AGUA\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 03 motores com inversor | unid | R$ 4500.0000 | L.J.D 160 | EX Cozinha\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 03 motores com inversor | unid | R$ 4500.0000 | L.J.D 160 | EX_AE\n[Mão de obra] Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 03 motores com inversor | unid | R$ 4500.0000 | L.J.D 160 | Pressurização\n[Mão de obra] Mão de Obra - Intertravamento | unid | R$ 750.0000 | - | AC - INDIRETA - AGUA\n[Mão de obra] Mão de Obra - Intertravamento | unid | R$ 750.0000 | - | EX Cozinha\n[Mão de obra] Mão de Obra - Intertravamento | unid | R$ 750.0000 | - | EX_AE\n[Mão de obra] Mão de Obra - Intertravamento | unid | R$ 750.0000 | - | Pressurização\n[Mão de obra] Mão de Obra VRF — Condensadoras | unid. | R$ 1000.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] Mão de Obra VRF — Evaporadoras + Infraestrutura | HP | R$ 750.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] Mão de Obra VRF — Evaporadoras + Infraestrutura | Und | R$ 1000.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] Mão de Obra VRF — Somente Infraestrutura | HP | R$ 550.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] Preço Mão de Obra Unidade Condensadora (1 por sistema) (MO) | Unid. | R$ 3000.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] Preço Mão de Obra Unidade Condensadora (1 por sistema) (MO) - ESPECIAIS | Unid. | R$ 6000.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] Preço Mão de Obra Unidade Condensadora (2 por sistema) (MO) | Unid. | R$ 6000.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] Preço Mão de Obra Unidade Condensadora (2 por sistema) (MO) - ESPECIAIS | Unid. | R$ 12000.0000 | - | AC - DIRETA - COBRE\n[Mão de obra] Residencial alto Padrão | 09.000 a 12.000 Btu/h | unid | R$ 850.5000 | - | AC Direta - tabela simplificada\n[Mão de obra] Residencial alto Padrão | 18.000 a 22.000 Btu/h | unid | R$ 1134.0000 | - | AC Direta - tabela simplificada\n[Mão de obra] Residencial alto Padrão | 30.000 a 36.000 Btu/h | unid | R$ 1323.0000 | - | AC Direta - tabela simplificada\n[Mão de obra] Residencial alto Padrão | 48.000 a 60.000 Btu/h | unid | R$ 1512.0000 | - | AC Direta - tabela simplificada\n[Mão de obra] Residencial alto Padrão | Built In | 09.000 a 12.000 Btu/h | unid | R$ 1890.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Residencial alto Padrão | Built In | 18.000 a 22.000 Btu/h | unid | R$ 2160.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Residencial alto Padrão | Built In | 30.000 a 36.000 Btu/h | unid | R$ 2430.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Residencial alto Padrão | Built In | 48.000 a 60.000 Btu/h | unid | R$ 2700.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Residencial alto Padrão | Cassete | 09.000 a 12.000 Btu/h | unid | R$ 1620.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Residencial alto Padrão | Cassete | 18.000 a 22.000 Btu/h | unid | R$ 1890.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Residencial alto Padrão | Cassete | 30.000 a 36.000 Btu/h | unid | R$ 2160.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Residencial alto Padrão | Cassete | 48.000 a 60.000 Btu/h | unid | R$ 2430.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Residencial alto Padrão | Hi Wall | 09.000 a 12.000 Btu/h | unid | R$ 1215.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Residencial alto Padrão | Hi Wall | 18.000 a 22.000 Btu/h | unid | R$ 1620.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Residencial alto Padrão | Piso Teto | 30.000 a 36.000 Btu/h | unid | R$ 1890.0000 | - | AC Direta - tabela detalhada\n[Mão de obra] Residencial alto Padrão | Piso Teto | 48.000 a 60.000 Btu/h | unid | R$ 2160.0000 | - | AC Direta - tabela detalhada\n[Outros] 1 1/2\" – SA H/M 038/038 | unid | R$ 26.9500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1 1/2\" – SA H/M 038/038 | unid | R$ 45.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1 1/2\" – SA R/T 038/038 | unid | R$ 26.9500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1 1/2\" – SA R/T 038/038 | unid | R$ 53.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1 1/4\" – SA H/M 032/035 | unid | R$ 23.4500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1 1/4\" – SA H/M 032/035 | unid | R$ 43.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1 1/4\" – SA R/T 032/035 | unid | R$ 23.4500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1 1/4\" – SA R/T 032/035 | unid | R$ 48.5000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1 1/8\" – SA H/M 025/028 | unid | R$ 23.4500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1 1/8\" – SA H/M 025/028 | unid | R$ 41.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1 1/8\" – SA R/T 025/028 | unid | R$ 23.4500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1 1/8\" – SA R/T 025/028 | unid | R$ 46.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1 3/8\" – SA H/M 032/035 | unid | R$ 26.9500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1 3/8\" – SA H/M 032/035 | unid | R$ 43.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1 3/8\" – SA R/T 032/035 | unid | R$ 26.9500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1 3/8\" – SA R/T 032/035 | unid | R$ 48.5000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1 5/8\" – SA H/M 040/040 | unid | R$ 33.6500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1 5/8\" – SA H/M 040/040 | unid | R$ 46.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1 5/8\" – SA R/T 040/042 | unid | R$ 33.6500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1 5/8\" – SA R/T 040/042 | unid | R$ 49.5000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1 7/8\" – SA H/M 048/048 | unid | R$ 33.6500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1 7/8\" – SA H/M 048/048 | unid | R$ 46.5000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1 7/8\" – SA R/T 048/048 | unid | R$ 33.6500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1 7/8\" – SA R/T 048/048 | unid | R$ 60.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1\" – SA H/M 025/028 | unid | R$ 20.1500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1\" – SA H/M 025/028 | unid | R$ 41.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1\" – SA R/T 025/028 | unid | R$ 20.1500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1\" – SA R/T 025/028 | unid | R$ 46.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1/2\" – 12,7mm – e=1/32\" | m | R$ 67.0950 | - | AC - DIRETA - COBRE\n[Outros] 1/2\" – SA H/M 012/015 | unid | R$ 11.4500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1/2\" – SA H/M 012/015 | unid | R$ 37.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1/2\" – SA R/T 012/015 | unid | R$ 11.4500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1/2\" – SA R/T 012/015 | unid | R$ 41.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1/4\" - 6,35mm – e= 1/32\" | m | R$ 28.7550 | - | AC - DIRETA - COBRE\n[Outros] 1/4\" – SA H/M 006/010 | unid | R$ 11.4500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1/4\" – SA H/M 006/010 | unid | R$ 36.5000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 1/4\" – SA R/T 006/010 | unid | R$ 11.4500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 1/4\" – SA R/T 006/010 | unid | R$ 40.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 2 1/8\" | unid. | R$ 966.0000 | Danfoss 23/05 | AC - DIRETA - COBRE\n[Outros] 2 1/8\" – SA H/M 054/054 | unid | R$ 49.4500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 2 1/8\" – SA H/M 054/054 | unid | R$ 53.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 2 1/8\" – SA R/T 054/054 | unid | R$ 49.4500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 2 1/8\" – SA R/T 054/054 | unid | R$ 60.5000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 3/4\" – SA H/M 018/022 | unid | R$ 14.7500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 3/4\" – SA H/M 018/022 | unid | R$ 39.5000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 3/4\" – SA R/T 018/022 | unid | R$ 14.7500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 3/4\" – SA R/T 018/022 | unid | R$ 45.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 3/8\" – 9,53mm – e=1/32\" | m | R$ 47.9250 | - | AC - DIRETA - COBRE\n[Outros] 3/8\" – SA H/M 006/010 | unid | R$ 11.4500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 3/8\" – SA H/M 006/010 | unid | R$ 36.5000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 3/8\" – SA R/T 006/010 | unid | R$ 11.4500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 3/8\" – SA R/T 006/010 | unid | R$ 40.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 5/8\" – 15,88mm – e=1/32\" | m | R$ 86.1300 | - | AC - DIRETA - COBRE\n[Outros] 5/8\" – SA H/M 012/015 | unid | R$ 14.7500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 5/8\" – SA H/M 012/015 | unid | R$ 37.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 5/8\" – SA R/T 012/015 | unid | R$ 14.7500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 5/8\" – SA R/T 012/015 | unid | R$ 41.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 7/8\" – SA H/M 018/022 | unid | R$ 20.1500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 7/8\" – SA H/M 018/022 | unid | R$ 39.5000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] 7/8\" – SA R/T 018/022 | unid | R$ 20.1500 | 24-06-2026 | AC - DIRETA - COBRE\n[Outros] 7/8\" – SA R/T 018/022 | unid | R$ 45.0000 | Sharing - 29-12-25 | AC - DIRETA - COBRE\n[Outros] ADBR 30 100 EA ALU MANTA ARMADUCT 30MM METALIZADA E ADESIVADA (RL C/ 7M2) | m² | R$ 372.0000 | Itermil 20-07-26 | EX Cozinha\n[Outros] ADBR 30 100 EA ALU MANTA ARMADUCT 30MM METALIZADA E ADESIVADA (RL C/ 7M2) | m² | R$ 372.0000 | Itermil 20-07-26 | EX_AE\n[Outros] ADBR 30 100 EA ALU MANTA ARMADUCT 30MM METALIZADA E ADESIVADA (RL C/ 7M2) | m² | R$ 372.0000 | Itermil 20-07-26 | Pressurização\n[Outros] Andaime (caso seja necessário) | mês | R$ 1200.0000 | - | AC - DIRETA - COBRE\n[Outros] Andaime (caso seja necessário) | mês | R$ 1200.0000 | - | AC - INDIRETA - AGUA\n[Outros] Andaime (caso seja necessário) | mês | R$ 600.0000 | - | EX Cozinha\n[Outros] Andaime (caso seja necessário) | mês | R$ 600.0000 | - | EX_AE\n[Outros] Andaime (caso seja necessário) | mês | R$ 600.0000 | - | Pressurização\n[Outros] Argamassa ACF | Balde (50kg) | R$ 800.0000 | - | AC - INDIRETA - AGUA\n[Outros] Argamassa RST | Balde (20kg) | R$ 1456.0000 | - | AC - INDIRETA - AGUA\n[Outros] Atuador On Off - 1\" | und | R$ 1629.6800 | - | AC - INDIRETA - AGUA\n[Outros] Atuador On Off - 3/4\" | und | R$ 1629.6800 | - | AC - INDIRETA - AGUA\n[Outros] Atuador Proporcional 1 1/2\" | - | R$ 2286.7100 | - | AC - INDIRETA - AGUA\n[Outros] Atuador Proporcional 1 1/4\" | - | R$ 2286.7100 | - | AC - INDIRETA - AGUA\n[Outros] Atuador Proporcional 2 1/2\" | - | R$ 2286.7100 | - | AC - INDIRETA - AGUA\n[Outros] Atuador Proporcional 2\" | - | R$ 2286.7100 | - | AC - INDIRETA - AGUA\n[Outros] Atuador Proporcional 3\" | - | R$ 2286.7100 | - | AC - INDIRETA - AGUA\n[Outros] Bandeja | Unid. | R$ 300.0000 | - | AC - INDIRETA - AGUA\n[Outros] Bandeja | - | R$ 500.0000 | - | AC - INDIRETA - AGUA\n[Outros] Barra Rosqueada de 1/4 pol. | m | R$ 4.4850 | 01/07/2026 | AC - DIRETA - COBRE\n[Outros] Barra Rosqueada de 1/4 pol. | m | R$ 4.4850 | 01/07/2026 | AC - INDIRETA - AGUA\n[Outros] Barra Rosqueada de 1/4 pol. | m | R$ 4.4850 | 01/07/2026 | EX Cozinha\n[Outros] Barra Rosqueada de 1/4 pol. | m | R$ 4.4850 | 01/07/2026 | EX_AE\n[Outros] Barra Rosqueada de 1/4 pol. | m | R$ 5.0000 | - | Pressurização\n[Outros] Barra Rosqueada de 5/16 pol. | m | R$ 7.2600 | 01/07/2026 | AC - DIRETA - COBRE\n[Outros] Barra Rosqueada de 5/16 pol. | m | R$ 7.2600 | 01/07/2026 | AC - INDIRETA - AGUA\n[Outros] Barra Rosqueada de 5/16 pol. | m | R$ 7.2600 | 01/07/2026 | EX Cozinha\n[Outros] Barra Rosqueada de 5/16 pol. | m | R$ 7.2600 | 01/07/2026 | EX_AE\n[Outros] Barra Rosqueada de 5/16 pol. | m | R$ 6.6600 | - | Pressurização\n[Outros] Bombas - 5\" | Unid | R$ 38154.0000 | - | AC - INDIRETA - AGUA\n[Outros] Cabo Comunicação | m | R$ 9.5000 | - | AC - DIRETA - COBRE\n[Outros] Cabo de Comunicação Shieldado 3x | m | R$ 9.5000 | 08/05/2026 | AC - DIRETA - COBRE\n[Outros] Caixa de MPU (Pedir com acessórios) - PAINEL MPU 10MMX2,0MX1,2M(2,4m2) - 20 UNID POR CAIXA | unid | R$ 4000.0000 | 07-07-26 | AC - DIRETA - COBRE\n[Outros] Caixa de MPU (Pedir com acessórios) - PAINEL MPU 10MMX2,0MX1,2M(2,4m2) - 20 UNID POR CAIXA | unid | R$ 4000.0000 | 07-07-26 | AC - INDIRETA - AGUA\n[Outros] Caixa de MPU (Pedir com acessórios) - PAINEL MPU 20MMX2,0MX1,2M(2,4M2) - 10 UNID POR CAIXA | unid | R$ 2500.0000 | 07-07-26 | AC - DIRETA - COBRE\n[Outros] Caixa de MPU (Pedir com acessórios) - PAINEL MPU 20MMX2,0MX1,2M(2,4M2) - 10 UNID POR CAIXA | unid | R$ 2500.0000 | 07-07-26 | AC - INDIRETA - AGUA\n[Outros] Caixa de MPU (Pedir com acessórios) - PAINEL MPU 30MMX2,0MX1,2(2,4M2) - 7 UNID POR CAIXA | unid | R$ 2600.0000 | 07-07-26 | AC - DIRETA - COBRE\n[Outros] Caixa de MPU (Pedir com acessórios) - PAINEL MPU 30MMX2,0MX1,2(2,4M2) - 7 UNID POR CAIXA | unid | R$ 2600.0000 | 07-07-26 | AC - INDIRETA - AGUA\n[Outros] Calço Antivibração para Equipamentos de Grande Porte (Kit c/ 4 un.) | unid | R$ 1000.0000 | - | AC - DIRETA - COBRE\n[Outros] Calço Antivibração para Equipamentos de Grande Porte (Kit c/ 4 un.) | unid | R$ 1200.0000 | - | AC - DIRETA - COBRE\n[Outros] Cantoneira 1 1/2 x 1/8pol. | m | R$ 90.0000 | TENAX 02/03/2026 | EX Cozinha\n[Outros] Cantoneira 1 1/4 x 1/8pol. | m | R$ 90.0000 | TENAX 02/03/2026 | Pressurização\n[Outros] Cantos para perfil | pç | R$ 1.1700 | 01/07/2026 | AC - DIRETA - COBRE\n[Outros] Cantos para perfil | pç | R$ 1.1700 | 01/07/2026 | AC - INDIRETA - AGUA\n[Outros] Cantos para perfil | pç | R$ 1.1700 | 01/07/2026 | EX Cozinha\n[Outros] Cantos para perfil | pç | R$ 1.1700 | 01/07/2026 | EX_AE\n[Outros] Cantos para perfil | pç | R$ 1.3000 | - | Pressurização\n[Outros] Carro (Strada) | mês | R$ 3000.0000 | - | AC - DIRETA - COBRE\n[Outros] Carro (Strada) | mês | R$ 3000.0000 | - | AC - INDIRETA - AGUA\n[Outros] Carro (Strada) | mês | R$ 3000.0000 | - | EX Cozinha\n[Outros] Carro (Strada) | mês | R$ 3000.0000 | - | EX_AE\n[Outros] Carro (Strada) | mês | R$ 3000.0000 | - | Pressurização\n[Outros] Chiller - 5\" | Unid | R$ 107847.6800 | - | AC - INDIRETA - AGUA\n[Outros] Chiller - 6\" | Unid | R$ 133615.6000 | - | AC - INDIRETA - AGUA\n[Outros] Chumbador de 1/4 pol. (Cone e Jaqueta) | pç | R$ 0.7650 | 01/07/2026 | AC - DIRETA - COBRE\n[Outros] Chumbador de 1/4 pol. (Cone e Jaqueta) | pç | R$ 0.7650 | 01/07/2026 | AC - INDIRETA - AGUA\n[Outros] Chumbador de 1/4 pol. (Cone e Jaqueta) | pç | R$ 0.7650 | 01/07/2026 | EX Cozinha\n[Outros] Chumbador de 1/4 pol. (Cone e Jaqueta) | pç | R$ 0.7650 | 01/07/2026 | EX_AE\n[Outros] Chumbador de 1/4 pol. (Cone e Jaqueta) | pç | R$ 1.0000 | - | Pressurização\n[Outros] Chumbador de 5/16 pol. (Cone e Jaqueta) | pç | R$ 1.3500 | 01/07/2026 | AC - DIRETA - COBRE\n[Outros] Chumbador de 5/16 pol. (Cone e Jaqueta) | pç | R$ 1.3500 | 01/07/2026 | AC - INDIRETA - AGUA\n[Outros] Chumbador de 5/16 pol. (Cone e Jaqueta) | pç | R$ 1.3500 | 01/07/2026 | EX Cozinha\n[Outros] Chumbador de 5/16 pol. (Cone e Jaqueta) | pç | R$ 1.3500 | 01/07/2026 | EX_AE\n[Outros] Chumbador de 5/16 pol. (Cone e Jaqueta) | pç | R$ 1.3000 | - | Pressurização\n[Outros] Componente A | KG | R$ 55.0000 | INTERMIL | AC - DIRETA - COBRE\n[Outros] Componente A | kg | R$ 55.0000 | INTERMIL | AC - INDIRETA - AGUA\n[Outros] Componente B | KG | R$ 55.0000 | INTERMIL | AC - DIRETA - COBRE\n[Outros] Componente B | kg | R$ 55.0000 | INTERMIL | AC - INDIRETA - AGUA\n[Outros] Cálcio Anti Vibração para Máquinas de Grande Porte (kit com 4) | unid | R$ 1200.0000 | 29-12-25 | AC - DIRETA - COBRE\n[Outros] Cálcio Anti Vibração para Máquinas de Grande Porte (kit com 4) | unid | R$ 1200.0000 | 29-12-25 | AC - INDIRETA - AGUA\n[Outros] Cálcio Anti Vibração para Máquinas de Grande Porte (kit com 4) | unid | R$ 1200.0000 | - | AC - INDIRETA - AGUA\n[Outros] Cálcio Anti Vibração para Máquinas de Grande Porte (kit com 4) | unid | R$ 1200.0000 | - | EX Cozinha\n[Outros] Cálcio Anti Vibração para Máquinas de Grande Porte (kit com 4) | unid | R$ 1200.0000 | 29-12-25 | EX_AE\n[Outros] Cálcio Anti Vibração para Máquinas de Grande Porte (kit com 4) | unid | R$ 1200.0000 | - | Pressurização\n[Outros] Energy valve - 6\" | unid | R$ 76570.0000 | - | AC - INDIRETA - AGUA\n[Outros] FANCOIL - 1 1/2\" | Unid | R$ 12306.5100 | - | AC - INDIRETA - AGUA\n[Outros] FANCOIL - 1 1/4\" | Unid | R$ 10739.8500 | - | AC - INDIRETA - AGUA\n[Outros] FANCOIL - 2 1/2\" | Unid | R$ 20645.8400 | - | AC - INDIRETA - AGUA\n[Outros] FANCOIL - 2\" | Unid | R$ 14963.3200 | - | AC - INDIRETA - AGUA\n[Outros] FANCOIL - 3\" | Unid | R$ 26786.2500 | - | AC - INDIRETA - AGUA\n[Outros] Fancolete - 1\" | - | R$ 5815.8300 | - | AC - INDIRETA - AGUA\n[Outros] Fancolete - 3/4\" | - | R$ 5402.1600 | - | AC - INDIRETA - AGUA\n[Outros] Fechamento | unid | R$ 200.0000 | - | AC - DIRETA - COBRE\n[Outros] Fechamento | unid | R$ 200.0000 | - | AC - INDIRETA - AGUA\n[Outros] Fita aluminizada - Rolo com 50m | pç | R$ 5.0000 | 01/07/2026 | AC - DIRETA - COBRE\n[Outros] Fita aluminizada - Rolo com 50m | pç | R$ 5.0000 | 01/07/2026 | AC - INDIRETA - AGUA\n[Outros] Fita aluminizada - Rolo com 50m | pç | R$ 5.0000 | 01/07/2026 | EX Cozinha\n[Outros] Fita aluminizada - Rolo com 50m | pç | R$ 5.0000 | 01/07/2026 | Pressurização\n[Outros] Flange sobreposta, aço carbono ANSI-150-LBS-RF - 5\" | unid | R$ 496.8000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Outros] Grampo com parafuso | pç | R$ 2.0000 | - | AC - DIRETA - COBRE\n[Outros] Grampo com parafuso | pç | R$ 2.0000 | - | AC - INDIRETA - AGUA\n[Outros] Grampo com parafuso | pç | R$ 2.0000 | - | EX Cozinha\n[Outros] Grampo com parafuso | pç | R$ 2.0000 | - | EX_AE\n[Outros] Grampo com parafuso | pç | R$ 2.0000 | - | Pressurização\n[Outros] GSP - até 1 CV | unid | R$ 700.0000 | - | AC - INDIRETA - AGUA\n[Outros] GSP - até 1 CV | unid | R$ 700.0000 | - | EX Cozinha\n[Outros] GSP - até 1 CV | unid | R$ 700.0000 | - | EX_AE\n[Outros] GSP - até 1 CV | unid | R$ 700.0000 | - | Pressurização\n[Outros] Horario Comercial | Hi Wall | 09.000 a 12.000 Btu/h | unid | R$ 900.0000 | - | AC - DIRETA - COBRE\n[Outros] Infra (distância até o ponto mais distante) | mts | R$ 40.0000 | Services BR | EX_AE\n[Outros] Interligações Elétricas | unid | R$ 1500.0000 | - | AC - DIRETA - COBRE\n[Outros] Isolador | M2 | R$ 60.0000 | - | AC - DIRETA - COBRE\n[Outros] Isolador | m² | R$ 60.0000 | - | AC - INDIRETA - AGUA\n[Outros] Junta flexível tipo Dynatecnica - 5\" | unid | R$ 650.0000 | - | AC - INDIRETA - AGUA\n[Outros] Junta flexível tipo Dynatecnica - 6\" | unid | R$ 735.0000 | SOUZA ALVEZ 03/07/26 | AC - INDIRETA - AGUA\n[Outros] Mangote 1\" - 50cm | Unid. | R$ 900.0000 | - | AC - INDIRETA - AGUA\n[Outros] Mangote 3/4\" - 50cm | Unid. | R$ 700.0000 | - | AC - INDIRETA - AGUA\n[Outros] Outros | SPLIT | R$ 300.0000 | - | AC - DIRETA - COBRE\n[Outros] Pano / Trapo - 01 unid. Limpa 10m² | unid | R$ 4.5000 | 01/07/2026 | AC - DIRETA - COBRE\n[Outros] Pano / Trapo - 01 unid. Limpa 10m² | unid | R$ 4.5000 | 01/07/2026 | AC - INDIRETA - AGUA\n[Outros] Pano / Trapo - 01 unid. Limpa 10m² | unid | R$ 4.5000 | 01/07/2026 | EX Cozinha\n[Outros] Pano / Trapo - 01 unid. Limpa 10m² | unid | R$ 4.5000 | 01/07/2026 | EX_AE\n[Outros] Pano / Trapo - 01 unid. Limpa 10m² | unid | R$ 3.0000 | - | Pressurização\n[Outros] Perfilado | m | R$ 22.0950 | 01/07/2026 | AC - DIRETA - COBRE\n[Outros] Perfilado | m | R$ 22.0950 | 01/07/2026 | AC - INDIRETA - AGUA\n[Outros] Perfilado | m | R$ 22.0950 | 01/07/2026 | EX Cozinha\n[Outros] Perfilado | m | R$ 22.0950 | 01/07/2026 | EX_AE\n[Outros] Perfilado | m | R$ 14.0000 | - | Pressurização\n[Outros] Polietileno Expandido - 10mm | m² | R$ 150.0000 | --- | AC - DIRETA - COBRE\n[Outros] Polietileno Expandido - 10mm | m² | R$ 150.0000 | --- | AC - INDIRETA - AGUA\n[Outros] Porca e parafuso - 5/16 | pç | R$ 0.6000 | 01/07/2026 | AC - DIRETA - COBRE\n[Outros] Porca e parafuso - 5/16 | pç | R$ 0.6000 | 01/07/2026 | AC - INDIRETA - AGUA\n[Outros] Porca e parafuso - 5/16 | pç | R$ 0.6000 | 01/07/2026 | EX Cozinha\n[Outros] Porca e parafuso - 5/16 | pç | R$ 0.6000 | 01/07/2026 | EX_AE\n[Outros] Porca e parafuso - 5/16 | pç | R$ 1.0000 | - | Pressurização\n[Outros] Porcas e parafusos 5/16 | pç | R$ 1.0000 | 46204 | EX Cozinha\n[Outros] Porcas e parafusos 5/16 | pç | R$ 1.0000 | 46204 | Pressurização\n[Outros] POÇO PARA TERMOMETRO, 1/2\" x 1/2\" x 50mm | - | R$ 114.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Outros] Proteção Mecânica - Aluminio Liso 0,7 mm | m² | R$ 130.0000 | - | AC - DIRETA - COBRE\n[Outros] Proteção Mecânica - Aluminio Liso 0,7 mm | m² | R$ 130.0000 | - | AC - INDIRETA - AGUA\n[Outros] Proteção Mecânica - ALUMÍNIO CORRUGADO ESP. 0,40MM - CORRUGAÇÃO 3/16\" SEM BARREIRA | m² | R$ 70.0000 | - | AC - DIRETA - COBRE\n[Outros] Remanejamento | m linear | R$ 150.0000 | - | AC - INDIRETA - AGUA\n[Outros] Residencial alto Padrão | 18.000 a 22.000 Btu/h | unid | R$ 1134.0000 | - | AC - DIRETA - COBRE\n[Outros] Saco de lixo de 100L/m² | unid | R$ 1.5000 | 01/07/2026 | AC - DIRETA - COBRE\n[Outros] Saco de lixo de 100L/m² | unid | R$ 1.5000 | 01/07/2026 | AC - INDIRETA - AGUA\n[Outros] Saco de lixo de 100L/m² | unid | R$ 1.5000 | 01/07/2026 | EX Cozinha\n[Outros] Saco de lixo de 100L/m² | unid | R$ 1.5000 | 01/07/2026 | EX_AE\n[Outros] Saco de lixo de 100L/m² | unid | R$ 1.0000 | - | Pressurização\n[Outros] Selo plástico | pç | R$ 0.2000 | 01/07/2026 | AC - DIRETA - COBRE\n[Outros] Selo plástico | pç | R$ 0.2000 | 01/07/2026 | AC - INDIRETA - AGUA\n[Outros] Selo plástico | pç | R$ 0.2000 | 01/07/2026 | EX Cozinha\n[Outros] Selo plástico | pç | R$ 0.2000 | 01/07/2026 | Pressurização\n[Outros] TAB | diária | R$ 1000.0000 | - | AC - DIRETA - COBRE\n[Outros] TAB | diária | R$ 1000.0000 | - | AC - INDIRETA - AGUA\n[Outros] TAB | diária | R$ 1000.0000 | - | EX_AE\n[Outros] TAB | diária | R$ 1000.0000 | - | Pressurização\n[Outros] TERMOMETRO CAPELA RETO, 0 à 50ºC, HASTE DE 50mm, ROSCA DE 1/2\" | - | R$ 468.0000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Outros] Teste de estanqueidade | diária | R$ 5000.0000 | - | AC - DIRETA - COBRE\n[Outros] Teste de estanqueidade | diária | R$ 5000.0000 | - | AC - INDIRETA - AGUA\n[Outros] Teste de estanqueidade | diária | R$ 5000.0000 | - | EX Cozinha\n[Outros] Teste de estanqueidade | diária | R$ 5000.0000 | - | EX_AE\n[Outros] Teste de estanqueidade | diária | R$ 5000.0000 | - | Pressurização\n[Outros] TORRE - 6\" | Unid | R$ 61260.0240 | - | AC - INDIRETA - AGUA\n[Outros] Tubulação - 1 1/2\" | m | R$ 124.3543 | SIDERAÇO RJ | AC - INDIRETA - AGUA\n[Outros] Tubulação - 1 1/4\" | m | R$ 110.0232 | SIDERAÇO RJ | AC - INDIRETA - AGUA\n[Outros] Tubulação - 1\" | m | R$ 85.3361 | SIDERAÇO RJ | AC - INDIRETA - AGUA\n[Outros] Tubulação - 2 1/2\" | m | R$ 222.4800 | SIDERAÇO RJ | AC - INDIRETA - AGUA\n[Outros] Tubulação - 2\" | m | R$ 150.7200 | SIDERAÇO RJ | AC - INDIRETA - AGUA\n[Outros] Tubulação - 3\" | m | R$ 286.7600 | SIDERAÇO RJ | AC - INDIRETA - AGUA\n[Outros] Tubulação - 3/4\" | m | R$ 86.0589 | SIDERAÇO RJ | AC - INDIRETA - AGUA\n[Outros] Tubulação - 4\" | m | R$ 395.8100 | SIDERAÇO RJ | AC - INDIRETA - AGUA\n[Outros] Tubulação - 5\" | m | R$ 554.7200 | SIDERAÇO RJ | AC - INDIRETA - AGUA\n[Outros] Tubulação - 6\" | m | R$ 691.8900 | SIDERAÇO RJ | AC - INDIRETA - AGUA\n[Outros] UNIÃO, GALVANIZADO, 150 LBS, ROSCA BSP, 1 1/2\" | - | R$ 232.8000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Outros] UNIÃO, GALVANIZADO, 150 LBS, ROSCA BSP, 1 1/4\" | - | R$ 200.4000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Outros] UNIÃO, GALVANIZADO, 150 LBS, ROSCA BSP, 2 1/2\" | - | R$ 487.2000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Outros] UNIÃO, GALVANIZADO, 150 LBS, ROSCA BSP, 2\" | - | R$ 321.6000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Outros] UNIÃO, GALVANIZADO, 150 LBS, ROSCA BSP, 3\" | - | R$ 712.8000 | Valflor 06-01-2026 | AC - INDIRETA - AGUA\n[Outros] Verba de Manutenção de limpeza na linha (141B, Solda Phoscoper, Nitrogênio, Oxigênio,etc) | Nº SISTEMA | R$ 850.0000 | 29-12-25 | AC - DIRETA - COBRE\n[Outros] Véu de Poliéster | Rolo | R$ 240.0000 | - | AC - INDIRETA - AGUA\n[Outros] Water flow Switch | unid | R$ 500.0000 | - | AC - INDIRETA - AGUA\n[Rede hidráulica] Tubulação - 1 1/2\" | m | R$ 124.3543 | - | Água Gelada - Galvanizado\n[Rede hidráulica] Tubulação - 1 1/2\" | m | R$ 36.4767 | - | Água Gelada - PVCU SCHD 8\n[Rede hidráulica] Tubulação - 1 1/4\" | m | R$ 110.0232 | - | Água Gelada - Galvanizado\n[Rede hidráulica] Tubulação - 1 1/4\" | m | R$ 27.2667 | - | Água Gelada - PVCU SCHD 8\n[Rede hidráulica] Tubulação - 1\" | m | R$ 85.3361 | - | Água Gelada - Galvanizado\n[Rede hidráulica] Tubulação - 1\" | m | R$ 19.8417 | - | Água Gelada - PVCU SCHD 8\n[Rede hidráulica] Tubulação - 2 1/2\" | m | R$ 222.4800 | - | Água Gelada - Galvanizado\n[Rede hidráulica] Tubulação - 2 1/2\" | m | R$ 68.0017 | - | Água Gelada - PVCU SCHD 8\n[Rede hidráulica] Tubulação - 2\" | m | R$ 150.7200 | - | Água Gelada - Galvanizado\n[Rede hidráulica] Tubulação - 2\" | m | R$ 38.2767 | - | Água Gelada - PVCU SCHD 8\n[Rede hidráulica] Tubulação - 3\" | m | R$ 286.7600 | - | Água Gelada - Galvanizado\n[Rede hidráulica] Tubulação - 3\" | m | R$ 102.4650 | - | Água Gelada - PVCU SCHD 8\n[Rede hidráulica] Tubulação - 3/4\" | m | R$ 86.0589 | - | Água Gelada - Galvanizado\n[Rede hidráulica] Tubulação - 3/4\" | m | R$ 16.7417 | - | Água Gelada - PVCU SCHD 8\n[Rede hidráulica] Tubulação - 4\" | m | R$ 395.8100 | - | Água Gelada - Galvanizado\n[Rede hidráulica] Tubulação - 4\" | m | R$ 140.2467 | - | Água Gelada - PVCU SCHD 8\n[Rede hidráulica] Tubulação - 5\" | m | R$ 554.7200 | - | Água Gelada - Galvanizado\n[Rede hidráulica] Tubulação - 5\" | m | R$ 313.0550 | - | Água Gelada - PVCU SCHD 8\n[Rede hidráulica] Tubulação - 6\" | m | R$ 691.8900 | - | Água Gelada - Galvanizado\n[Rede hidráulica] Tubulação - 6\" | m | R$ 313.0550 | - | Água Gelada - PVCU SCHD 8\n\nREGRA FINAL: use esta base apenas para precificação. O levantamento técnico e quantitativo continua obedecendo ao prompt principal do agente.";

export const SABRAR_ECONOMIC_BASE_ITEMS = [
  {
    "category": "Administrativo / logística",
    "item": "Alimentação",
    "unit": "mês",
    "price": 900,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Alimentação",
    "unit": "mês",
    "price": 900,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Administrativo / logística",
    "item": "Alimentação",
    "unit": "mês",
    "price": 660,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Administrativo / logística",
    "item": "Alimentação",
    "unit": "mês",
    "price": 660,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Alimentação",
    "unit": "mês",
    "price": 660,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Administrativo / logística",
    "item": "ART",
    "unit": "vb",
    "price": 350,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Administrativo / logística",
    "item": "ART",
    "unit": "vb",
    "price": 300,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Administrativo / logística",
    "item": "ART",
    "unit": "vb",
    "price": 300,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Administrativo / logística",
    "item": "ART",
    "unit": "vb",
    "price": 300,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Administrativo / logística",
    "item": "ART",
    "unit": "vb",
    "price": 300,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Administrativo / logística",
    "item": "As Built",
    "unit": "vb",
    "price": 1500,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Administrativo / logística",
    "item": "As Built",
    "unit": "vb",
    "price": 1500,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Administrativo / logística",
    "item": "As Built",
    "unit": "vb",
    "price": 1500,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Administrativo / logística",
    "item": "As Built",
    "unit": "vb",
    "price": 1500,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Administrativo / logística",
    "item": "As Built",
    "unit": "vb",
    "price": 1500,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Administrativo / logística",
    "item": "Databook",
    "unit": "vb",
    "price": 500,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Databook",
    "unit": "vb",
    "price": 500,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Administrativo / logística",
    "item": "Databook",
    "unit": "vb",
    "price": 500,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Administrativo / logística",
    "item": "Databook",
    "unit": "vb",
    "price": 500,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Databook",
    "unit": "vb",
    "price": 500,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Administrativo / logística",
    "item": "Engenheiro - salário-base",
    "unit": "mês",
    "price": 8000,
    "supplier": "-",
    "context": "Custos ADM"
  },
  {
    "category": "Administrativo / logística",
    "item": "Gasolina",
    "unit": "L",
    "price": 5,
    "supplier": "-",
    "context": "Custos ADM"
  },
  {
    "category": "Administrativo / logística",
    "item": "GEM",
    "unit": "vb",
    "price": 1500,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Administrativo / logística",
    "item": "GEM",
    "unit": "vb",
    "price": 1500,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Administrativo / logística",
    "item": "GEM",
    "unit": "vb",
    "price": 1500,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Administrativo / logística",
    "item": "GEM",
    "unit": "vb",
    "price": 1500,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Administrativo / logística",
    "item": "GEM",
    "unit": "vb",
    "price": 1500,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Administrativo / logística",
    "item": "Hospedagem",
    "unit": "mês",
    "price": 6000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Hospedagem",
    "unit": "mês",
    "price": 6000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Administrativo / logística",
    "item": "Hospedagem",
    "unit": "mês",
    "price": 3000,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Administrativo / logística",
    "item": "Hospedagem",
    "unit": "mês",
    "price": 3000,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Hospedagem",
    "unit": "mês",
    "price": 3000,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Administrativo / logística",
    "item": "Içamento",
    "unit": "diária",
    "price": 6800,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Içamento",
    "unit": "diária",
    "price": 6800,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Administrativo / logística",
    "item": "Içamento",
    "unit": "diária",
    "price": 6800,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Administrativo / logística",
    "item": "Içamento",
    "unit": "diária",
    "price": 6800,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Içamento",
    "unit": "diária",
    "price": 6800,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Administrativo / logística",
    "item": "Manual",
    "unit": "vb",
    "price": 500,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Manual",
    "unit": "vb",
    "price": 500,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Administrativo / logística",
    "item": "Manual",
    "unit": "vb",
    "price": 500,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Administrativo / logística",
    "item": "Manual",
    "unit": "vb",
    "price": 500,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Manual",
    "unit": "vb",
    "price": 500,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Administrativo / logística",
    "item": "Passagem Aérea (2x por mês)",
    "unit": "qtd",
    "price": 3500,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Passagem Aérea (2x por mês)",
    "unit": "qtd",
    "price": 3500,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Administrativo / logística",
    "item": "Passagem Aérea (2x por mês)",
    "unit": "qtd",
    "price": 2500,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Administrativo / logística",
    "item": "Passagem Aérea (2x por mês)",
    "unit": "qtd",
    "price": 2500,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Passagem Aérea (2x por mês)",
    "unit": "qtd",
    "price": 2500,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Administrativo / logística",
    "item": "Picagem/Trepanação Tubulação - SEM DRENAGEM DE ÁGUA (DUAS LINHAS) (CONGELAMENTO)",
    "unit": "vb",
    "price": 16000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Administrativo / logística",
    "item": "Plataforma elevatória - se for pé direito duplo",
    "unit": "mês",
    "price": 10000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Plataforma elevatória - se for pé direito duplo",
    "unit": "mês",
    "price": 10000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Administrativo / logística",
    "item": "Plataforma elevatória - se for pé direito duplo",
    "unit": "mês",
    "price": 10000,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Administrativo / logística",
    "item": "Plataforma elevatória - se for pé direito duplo",
    "unit": "mês",
    "price": 10000,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Plataforma elevatória - se for pé direito duplo",
    "unit": "mês",
    "price": 10000,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Administrativo / logística",
    "item": "Supervisor - 6 Horas - 22 Dias/ Mês",
    "unit": "mês",
    "price": 12000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Supervisor - 6 Horas - 22 Dias/ Mês",
    "unit": "mês",
    "price": 12000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Administrativo / logística",
    "item": "Supervisor - 6 Horas - 22 Dias/ Mês",
    "unit": "mês",
    "price": 12000,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Administrativo / logística",
    "item": "Supervisor - 6 Horas - 22 Dias/ Mês",
    "unit": "mês",
    "price": 12000,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Supervisor - 6 Horas - 22 Dias/ Mês",
    "unit": "mês",
    "price": 12000,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Administrativo / logística",
    "item": "Supervisor - salário-base",
    "unit": "mês",
    "price": 5000,
    "supplier": "-",
    "context": "Custos ADM"
  },
  {
    "category": "Administrativo / logística",
    "item": "Transporte",
    "unit": "mês",
    "price": 550,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Transporte",
    "unit": "mês",
    "price": 550,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Administrativo / logística",
    "item": "Transporte",
    "unit": "mês",
    "price": 390,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Administrativo / logística",
    "item": "Transporte",
    "unit": "mês",
    "price": 390,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Administrativo / logística",
    "item": "Transporte",
    "unit": "mês",
    "price": 390,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Automação",
    "item": "Automação Simples - Stand Alone (Quadro)",
    "unit": "unid",
    "price": 25000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Automação",
    "item": "Quadro de Automação de Pressurização p/ ventilador com inversor de frequência, contactora, dispositivos de proteção, proteção, painél com chaves seletores e botão seco - 1 VENTILADOR",
    "unit": "vb",
    "price": 28000,
    "supplier": "Services BR",
    "context": "EX_AE"
  },
  {
    "category": "Automação",
    "item": "Quadro de Automação de Pressurização p/ ventilador com inversor de frequência, contactora, dispositivos de proteção, proteção, painél com chaves seletores e botão seco - 2 VENTILADORES",
    "unit": "vb",
    "price": 40000,
    "supplier": "Services BR",
    "context": "EX_AE"
  },
  {
    "category": "Dutos",
    "item": "Chapa Alumínio - Matéria Prima e Fabricação",
    "unit": "kg",
    "price": 35,
    "supplier": "Espiroduto",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Chapa Alumínio - Matéria Prima e Fabricação",
    "unit": "kg",
    "price": 35,
    "supplier": "Espiroduto",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Chapa Galvanizada - Exaustão e Ventilação",
    "unit": "KG",
    "price": 14,
    "supplier": "---",
    "context": "EX Cozinha"
  },
  {
    "category": "Dutos",
    "item": "Chapa Galvanizada - Exaustão e Ventilação",
    "unit": "KG",
    "price": 14,
    "supplier": "---",
    "context": "Pressurização"
  },
  {
    "category": "Dutos",
    "item": "Chapa Galvanizada - Exaustão e Ventilação (Revestimento B)",
    "unit": "KG",
    "price": 12,
    "supplier": "---",
    "context": "EX_AE"
  },
  {
    "category": "Dutos",
    "item": "Chapa Galvanizada - Insuflamento e Retorno",
    "unit": "KG",
    "price": 12,
    "supplier": "---",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Chapa Galvanizada - Insuflamento e Retorno (Revestimento B)",
    "unit": "KG",
    "price": 12,
    "supplier": "Felipe - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Chapa Galvanizada - Matéria Prima e Fabricação",
    "unit": "kg",
    "price": 30,
    "supplier": "Espiroduto - Junho/26",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Chapa Galvanizada - Matéria Prima e Fabricação",
    "unit": "kg",
    "price": 90,
    "supplier": "Espiroduto",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Chapa Preta - Exaustão",
    "unit": "KG",
    "price": 12,
    "supplier": "---",
    "context": "EX Cozinha"
  },
  {
    "category": "Dutos",
    "item": "Chapa Preta - Exaustão",
    "unit": "KG",
    "price": 12,
    "supplier": "---",
    "context": "Pressurização"
  },
  {
    "category": "Dutos",
    "item": "Dutos Flexivéis - 100 mm (unid c/ 6m) - ISODEC 4\"",
    "unit": "pç",
    "price": 105,
    "supplier": "ITERMIL - 03/07/26",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Dutos Flexivéis - 100 mm (unid c/ 6m) - ISODEC 4\"",
    "unit": "pç",
    "price": 105,
    "supplier": "ITERMIL - 03/07/26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Dutos Flexivéis - 150 mm (unid c/ 6m) - ISODEC 6\"",
    "unit": "pç",
    "price": 143,
    "supplier": "ITERMIL - 03/07/26",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Dutos Flexivéis - 150 mm (unid c/ 6m) - ISODEC 6\"",
    "unit": "pç",
    "price": 143,
    "supplier": "ITERMIL - 03/07/26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Dutos Flexivéis - 200 mm (unid c/ 6m) - ISODEC 8\"",
    "unit": "pç",
    "price": 186,
    "supplier": "ITERMIL - 03/07/26",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Dutos Flexivéis - 200 mm (unid c/ 6m) - ISODEC 8\"",
    "unit": "pç",
    "price": 186,
    "supplier": "ITERMIL - 03/07/26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Dutos Flexivéis - 250 mm (unid c/ 6m) - ISODEC 10\"",
    "unit": "pç",
    "price": 228,
    "supplier": "ITERMIL - 03/07/26",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Dutos Flexivéis - 250 mm (unid c/ 6m) - ISODEC 10\"",
    "unit": "pç",
    "price": 228,
    "supplier": "ITERMIL - 03/07/26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Dutos Flexivéis - 300 mm (unid c/ 6m) - ISODEC 12\"",
    "unit": "pç",
    "price": 287,
    "supplier": "ITERMIL - 03/07/26",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Dutos Flexivéis - 300 mm (unid c/ 6m) - ISODEC 12\"",
    "unit": "pç",
    "price": 287,
    "supplier": "ITERMIL - 03/07/26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Fita Cyclop - Arquear",
    "unit": "m",
    "price": 0.2,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Fita Cyclop - Arquear",
    "unit": "m",
    "price": 0.2,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Fita Cyclop - Arquear",
    "unit": "m",
    "price": 0.2,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Dutos",
    "item": "Fita Cyclop - Arquear",
    "unit": "m",
    "price": 0.2,
    "supplier": "01/07/2026",
    "context": "Pressurização"
  },
  {
    "category": "Dutos",
    "item": "Fita vitocel - TDC",
    "unit": "m",
    "price": 1.26,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Fita vitocel - TDC",
    "unit": "m",
    "price": 1.26,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Fita vitocel - TDC",
    "unit": "m",
    "price": 1.26,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Dutos",
    "item": "Fita vitocel - TDC",
    "unit": "m",
    "price": 1.26,
    "supplier": "01/07/2026",
    "context": "EX_AE"
  },
  {
    "category": "Dutos",
    "item": "Fita vitocel - TDC",
    "unit": "m",
    "price": 1.5,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Dutos",
    "item": "Limpeza de dutos",
    "unit": "m linear",
    "price": 12,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Limpeza de dutos",
    "unit": "m linear",
    "price": 12,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Limpeza de dutos",
    "unit": "m linear",
    "price": 12,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Dutos",
    "item": "Limpeza de dutos",
    "unit": "m linear",
    "price": 12,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Dutos",
    "item": "Manta de silicone para 200 graus",
    "unit": "m",
    "price": 200,
    "supplier": "SIENA VEDAÇÃO 25/02/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Dutos",
    "item": "Manta de silicone para 200 graus",
    "unit": "m",
    "price": 200,
    "supplier": "SIENA VEDAÇÃO 25/02/2026",
    "context": "Pressurização"
  },
  {
    "category": "Dutos",
    "item": "Pintura dos dutos (Tinta+acessórios e MDO)",
    "unit": "m²",
    "price": 100,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Pintura dos dutos (Tinta+acessórios e MDO)",
    "unit": "m²",
    "price": 100,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Pintura dos dutos (Tinta+acessórios e MDO)",
    "unit": "m²",
    "price": 100,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Dutos",
    "item": "Pintura dos dutos (Tinta+acessórios e MDO)",
    "unit": "m²",
    "price": 100,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Dutos",
    "item": "Pintura dos dutos (Tinta+acessórios e MDO)",
    "unit": "m²",
    "price": 100,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Dutos",
    "item": "Porta de inspeção (SOMENTE SE NECESSÁRIO)",
    "unit": "unid",
    "price": 130,
    "supplier": "Não",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Porta de inspeção (SOMENTE SE NECESSÁRIO)",
    "unit": "unid",
    "price": 130,
    "supplier": "Não",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Porta de inspeção (SOMENTE SE SOLICITADO)",
    "unit": "unid",
    "price": 130,
    "supplier": "Não",
    "context": "EX Cozinha"
  },
  {
    "category": "Dutos",
    "item": "Porta de inspeção (SOMENTE SE SOLICITADO)",
    "unit": "unid",
    "price": 130,
    "supplier": "Não",
    "context": "EX_AE"
  },
  {
    "category": "Dutos",
    "item": "Porta de inspeção (SOMENTE SE SOLICITADO)",
    "unit": "unid",
    "price": 130,
    "supplier": "Não",
    "context": "Pressurização"
  },
  {
    "category": "Dutos",
    "item": "Porta de Inspeção - a cada 1,1 metro",
    "unit": "unid",
    "price": 250,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Dutos",
    "item": "Porta de Inspeção - a cada 1,1 metro",
    "unit": "unid",
    "price": 230,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Dutos",
    "item": "Remanejamento de duto",
    "unit": "kg *2",
    "price": 150,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Remanejamento de duto",
    "unit": "m linear",
    "price": 150,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Dutos",
    "item": "Remanejamento de duto",
    "unit": "m linear",
    "price": 150,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Dutos",
    "item": "Silicone p/ TDC - Sikaflex",
    "unit": "pç",
    "price": 12.09,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Dutos",
    "item": "Silicone p/ TDC - Sikaflex",
    "unit": "pç",
    "price": 12.09,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Dutos",
    "item": "Silicone p/ TDC - Sikaflex",
    "unit": "pç",
    "price": 12.09,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Dutos",
    "item": "Silicone p/ TDC - Sikaflex",
    "unit": "pç",
    "price": 12.09,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Dutos",
    "item": "Silicone p/ TDC - Sikaflex",
    "unit": "pç",
    "price": 19,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Dutos",
    "item": "Silicone vermelho",
    "unit": "pç",
    "price": 26,
    "supplier": "46146",
    "context": "EX Cozinha"
  },
  {
    "category": "Dutos",
    "item": "Silicone vermelho",
    "unit": "pç",
    "price": 26,
    "supplier": "46146",
    "context": "Pressurização"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 8900,
    "supplier": "MS Quadros - 04-08-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 8900,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 8900,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX_AE"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 8900,
    "supplier": "MS Quadros - 04-08-26",
    "context": "Pressurização"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 V OU 380 V (PARTIDA DIRETA)",
    "unit": "unid",
    "price": 3900,
    "supplier": "MS Quadros - 04-08-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 V OU 380 V (PARTIDA DIRETA)",
    "unit": "unid",
    "price": 3900,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 V OU 380 V (PARTIDA DIRETA)",
    "unit": "unid",
    "price": 3900,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX_AE"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 V OU 380 V (PARTIDA DIRETA)",
    "unit": "unid",
    "price": 3900,
    "supplier": "MS Quadros - 04-08-26",
    "context": "Pressurização"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 6600,
    "supplier": "MS Quadros - 04-08-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 6600,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 6600,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX_AE"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 6600,
    "supplier": "MS Quadros - 04-08-26",
    "context": "Pressurização"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 7800,
    "supplier": "MS Quadros - 04-08-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 7800,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 7800,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX_AE"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR ATÉ 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 7800,
    "supplier": "MS Quadros - 04-08-26",
    "context": "Pressurização"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR DE 12.5 CV ATÉ 15 CV 380 VCA (PARTIDA SOFT STARTER)",
    "unit": "unid",
    "price": 7800,
    "supplier": "MS Quadros - 04-08-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR DE 12.5 CV ATÉ 15 CV 380 VCA (PARTIDA SOFT STARTER)",
    "unit": "unid",
    "price": 7800,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR DE 12.5 CV ATÉ 15 CV 380 VCA (PARTIDA SOFT STARTER)",
    "unit": "unid",
    "price": 7800,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX_AE"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR DE 12.5 CV ATÉ 15 CV 380 VCA (PARTIDA SOFT STARTER)",
    "unit": "unid",
    "price": 7800,
    "supplier": "MS Quadros - 04-08-26",
    "context": "Pressurização"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5 CV ATÉ 10 CV 380 VCA (PARTIDA SOFT STARTER)",
    "unit": "unid",
    "price": 6900,
    "supplier": "MS Quadros - 04-08-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5 CV ATÉ 10 CV 380 VCA (PARTIDA SOFT STARTER)",
    "unit": "unid",
    "price": 6900,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5 CV ATÉ 10 CV 380 VCA (PARTIDA SOFT STARTER)",
    "unit": "unid",
    "price": 6900,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX_AE"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5 CV ATÉ 10 CV 380 VCA (PARTIDA SOFT STARTER)",
    "unit": "unid",
    "price": 6900,
    "supplier": "MS Quadros - 04-08-26",
    "context": "Pressurização"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5CV ATÉ 15 CV SENDO 220 VCA (PARTIDA ESTRELA TRIANGULO)",
    "unit": "unid",
    "price": 3600,
    "supplier": "MS Quadros - 04-08-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5CV ATÉ 15 CV SENDO 220 VCA (PARTIDA ESTRELA TRIANGULO)",
    "unit": "unid",
    "price": 3600,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5CV ATÉ 15 CV SENDO 220 VCA (PARTIDA ESTRELA TRIANGULO)",
    "unit": "unid",
    "price": 3600,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX_AE"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 01 MOTOR DE 7.5CV ATÉ 15 CV SENDO 220 VCA (PARTIDA ESTRELA TRIANGULO)",
    "unit": "unid",
    "price": 3600,
    "supplier": "MS Quadros - 04-08-26",
    "context": "Pressurização"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 14600,
    "supplier": "MS Quadros - 04-08-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 14600,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 14600,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX_AE"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 14600,
    "supplier": "MS Quadros - 04-08-26",
    "context": "Pressurização"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (PARTIDA DIRETA)",
    "unit": "unid",
    "price": 4800,
    "supplier": "MS Quadros - 04-08-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (PARTIDA DIRETA)",
    "unit": "unid",
    "price": 4800,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (PARTIDA DIRETA)",
    "unit": "unid",
    "price": 4800,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX_AE"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES ATÉ 5CV SENDO 220 Vca OU 380 Vca (PARTIDA DIRETA)",
    "unit": "unid",
    "price": 4800,
    "supplier": "MS Quadros - 04-08-26",
    "context": "Pressurização"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES DE 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 21700,
    "supplier": "MS Quadros - 04-08-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES DE 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 21700,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES DE 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 21700,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX_AE"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES DE 12.5CV ATE 15CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 21700,
    "supplier": "MS Quadros - 04-08-26",
    "context": "Pressurização"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES DE 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 17500,
    "supplier": "MS Quadros - 04-08-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES DE 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 17500,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES DE 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 17500,
    "supplier": "MS Quadros - 04-08-26",
    "context": "EX_AE"
  },
  {
    "category": "Elétrica",
    "item": "QUADRO ELÉTRICO PARA 03 MOTORES DE 7.5CV ATE 10CV SENDO 220 Vca OU 380 Vca (INVERSOR DE FREQUENCIA)",
    "unit": "unid",
    "price": 17500,
    "supplier": "MS Quadros - 04-08-26",
    "context": "Pressurização"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Armafix - 1 1/2\" - 48",
    "unit": "unid",
    "price": 44.11,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Armafix - 1 1/4\" - 42",
    "unit": "unid",
    "price": 38.52,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Armafix - 1\" - 35",
    "unit": "unid",
    "price": 37.58,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Armafix - 2 1/2\" - 76",
    "unit": "unid",
    "price": 69.88,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Armafix - 2\" - 60",
    "unit": "unid",
    "price": 53.67,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Armafix - 3\" - 89",
    "unit": "unid",
    "price": 80.69,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Armafix - 3/4\" - 28",
    "unit": "unid",
    "price": 35.59,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Armafix - 4\" - 114",
    "unit": "unid",
    "price": 122.48,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Armafix - 5\" - 140",
    "unit": "unid",
    "price": 157.26,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Armafix - 6\" - 168",
    "unit": "unid",
    "price": 225.89,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Armafix - 8\" - 219",
    "unit": "unid",
    "price": 577.53,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "FILTRO TIPO Y, LATÃO, COM ROSCA BSP, 1 1/2\"",
    "unit": "-",
    "price": 229.2,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "FILTRO TIPO Y, LATÃO, COM ROSCA BSP, 1 1/4\"",
    "unit": "-",
    "price": 165.6,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "FILTRO TIPO Y, LATÃO, COM ROSCA BSP, 2 1/2\"",
    "unit": "-",
    "price": 618,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "FILTRO TIPO Y, LATÃO, COM ROSCA BSP, 2\"",
    "unit": "-",
    "price": 386.4,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "FILTRO TIPO Y, LATÃO, COM ROSCA BSP, 3\"",
    "unit": "-",
    "price": 858,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Filtro Y 1\"",
    "unit": "Unid.",
    "price": 66,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Filtro Y 3/4\"",
    "unit": "Unid.",
    "price": 45,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Filtro Y Ferro fundido com flange- 5\"",
    "unit": "unid",
    "price": 2904,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Filtro Y Ferro fundido com flange- 6\"",
    "unit": "unid",
    "price": 3696,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Manômetro com Glicerina 10Kg",
    "unit": "Unid.",
    "price": 170,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "MANÔMETRO RETO, C/GLICERINA MOSTRADOR 4\", ESCALA 0 à 10 KGF, ROSCA 1/2\"",
    "unit": "-",
    "price": 270,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Manômetro reto, mostrados de 4\", escala 0 a 100 pSI x 7KGF, rosca de 1/2\"",
    "unit": "unid",
    "price": 270,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Poço para Termômetro",
    "unit": "Unid.",
    "price": 44,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Poço para Termômetro",
    "unit": "Unid.",
    "price": 65,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Termômetro Capela 0-50",
    "unit": "Unid.",
    "price": 205,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Termômetro capela reto, 0 a50ºC, Haste de 50mm, Rosca de 1/2",
    "unit": "unid",
    "price": 468,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "valvula energy valve - 5\"",
    "unit": "unid",
    "price": 59899.38,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VALVULA GBC - 10s - 009L7051 - 3/8\"",
    "unit": "unid.",
    "price": 119.2,
    "supplier": "08/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VALVULA GBC - 12s - 009L7052 - 1/2\"",
    "unit": "unid.",
    "price": 123.2,
    "supplier": "08/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VALVULA GBC - 16s - 009L7053 - 5/8\"",
    "unit": "unid.",
    "price": 122.4,
    "supplier": "08/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VALVULA GBC - 18s - 009L7054 - 3/4\"",
    "unit": "unid.",
    "price": 214.7,
    "supplier": "08/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VALVULA GBC - 22s - 009L7055 - 7/8\"",
    "unit": "unid.",
    "price": 215.65,
    "supplier": "08/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VALVULA GBC - 28s - 009L7056 - 1 1/8\"",
    "unit": "unid.",
    "price": 302.1,
    "supplier": "08/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VALVULA GBC - 35s - 009L7057 - 1 3/8\"",
    "unit": "unid.",
    "price": 580.52,
    "supplier": "08/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VALVULA GBC - 42s - 009L7058 - 1 5/8\"",
    "unit": "unid.",
    "price": 704.72,
    "supplier": "08/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VALVULA GBC - 6s - 009L7050 - 1/4\"",
    "unit": "unid.",
    "price": 151.2,
    "supplier": "08/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Válvula 2 vias de controle On Off - 1\"",
    "unit": "Unid.",
    "price": 1027.84,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Válvula 2 vias de controle On Off - 3/4\"",
    "unit": "Unid.",
    "price": 1066.91,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VÁLVULA BLOQUEIO 1 1/2\" OFERTAMOS VALVULA ESFERA MONOBLOCO ROSCA 1 1/2\"",
    "unit": "-",
    "price": 201.6,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VÁLVULA BLOQUEIO 1 1/4\" OFERTAMOS VALVULA ESFERA MONOBLOCO ROSCA 1 1/4\"",
    "unit": "-",
    "price": 154.8,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VÁLVULA BLOQUEIO 1/2\" OFERTAMOS VALVULA ESFERA MONOBLOCO, ROSCA BSP 1/2\"",
    "unit": "-",
    "price": 37.2,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VÁLVULA BLOQUEIO 1/2\" OFERTAMOS VALVULA ESFERA MONOBLOCO, ROSCA BSP 1/2\"",
    "unit": "-",
    "price": 42,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VÁLVULA BLOQUEIO 2 1/2\" OFERTAMOS VALVULA ESFERA MONOBLOCO ROSCA 2 1/2\"",
    "unit": "-",
    "price": 936,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VÁLVULA BLOQUEIO 2\" OFERTAMOS VALVULA ESFERA MONOBLOCO ROSCA 2\"",
    "unit": "-",
    "price": 327.6,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "VÁLVULA BLOQUEIO 3\" OFERTAMOS VALVULA ESFERA MONOBLOCO C/ROSCA BSP 3\"",
    "unit": "-",
    "price": 1082.4,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Válvula borboleta tipo Wafer Motorizada - 5\" AT Eletrico 100NM 220V",
    "unit": "unid",
    "price": 5952,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Válvula borboleta tipo Wafer Motorizada - 6\" AT Eletrico 100NM 220V",
    "unit": "unid",
    "price": 6240,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Válvula borboleta wafe, acionamento alavanca - 5\"",
    "unit": "unid",
    "price": 1164,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Válvula esfera Bipartida, aço carbono, ANSI-150-LBS-RF- 5\"",
    "unit": "unid",
    "price": 7056,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Válvula esfera Bipartida, aço carbono, ANSI-150-LBS-RF- 6\"",
    "unit": "unid",
    "price": 7056,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Hidráulica / acessórios",
    "item": "Válvula independente de pressão EV 2 vias, 6\" - 24V, GPM 713 + Atuador",
    "unit": "unid",
    "price": 106000,
    "supplier": "By Import - 03-07-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "1 1/2\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 24,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 1/2\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 24,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1 1/2\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 41.45,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 1/2\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 41.45,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1 1/2\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 63.12,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 1/2\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 63.12,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 1/2\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 95.42,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 1/2\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 95.42,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 1/2\" – SA H/M 038/038",
    "unit": "26.95",
    "price": 45,
    "supplier": "1 1/2\" – SA H/M 038/038",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 1/2\" – SA R/T 038/038",
    "unit": "26.95",
    "price": 53,
    "supplier": "1 1/2\" – SA R/T 038/038",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 1/4\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 19.5,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 1/4\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 19.5,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1 1/4\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 57.51,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 1/4\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 57.51,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 1/4\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 82.88,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 1/4\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 82.88,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 1/4\" – SA H/M 032/035",
    "unit": "23.45",
    "price": 43,
    "supplier": "1 1/4\" – SA H/M 032/035",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 1/4\" – SA R/T 032/035",
    "unit": "23.45",
    "price": 48.5,
    "supplier": "1 1/4\" – SA R/T 032/035",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 1/4\"- ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 38.22,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 1/4\"- ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 38.22,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1 1/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 17.5,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 1/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 17.5,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1 1/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 36.36,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 1/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 36.36,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 1/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 36.36,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1 1/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 49.4,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 1/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 49.4,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 1/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 75.79,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 1/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 75.79,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 1/8\" – SA H/M 025/028",
    "unit": "23.45",
    "price": 41,
    "supplier": "1 1/8\" – SA H/M 025/028",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 1/8\" – SA R/T 025/028",
    "unit": "23.45",
    "price": 46,
    "supplier": "1 1/8\" – SA R/T 025/028",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 3/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 21.5,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 3/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 21.5,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1 3/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 40.4,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 3/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 40.4,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1 3/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 60.64,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 3/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 60.64,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 3/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 88.14,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 3/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 88.14,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 3/8\" – SA H/M 032/035",
    "unit": "26.95",
    "price": 43,
    "supplier": "1 3/8\" – SA H/M 032/035",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 3/8\" – SA R/T 032/035",
    "unit": "26.95",
    "price": 48.5,
    "supplier": "1 3/8\" – SA R/T 032/035",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 5/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 26.8,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 5/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 26.8,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1 5/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 67.06,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 5/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 67.06,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 5/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 102.59,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 5/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 102.59,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 5/8\" – SA H/M 040/040",
    "unit": "33.65",
    "price": 46,
    "supplier": "1 5/8\" – SA H/M 040/040",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 5/8\" – SA R/T 040/042",
    "unit": "33.65",
    "price": 49.5,
    "supplier": "1 5/8\" – SA R/T 040/042",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 5/8\"- ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 46.98,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 5/8\"- ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 46.98,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1 7/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 30.3,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 7/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 30.3,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1 7/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 50.76,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 7/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 50.76,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1 7/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 74.32,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 7/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 74.32,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 7/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 114.43,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1 7/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 114.43,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 7/8\" – SA H/M 048/048",
    "unit": "33.65",
    "price": 46.5,
    "supplier": "1 7/8\" – SA H/M 048/048",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1 7/8\" – SA R/T 048/048",
    "unit": "33.65",
    "price": 60,
    "supplier": "1 7/8\" – SA R/T 048/048",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 15.8,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 15.8,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 30.21,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 30.21,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 30.21,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 46.35,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 46.35,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 70.92,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 70.92,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1\" – SA H/M 025/028",
    "unit": "20.15",
    "price": 41,
    "supplier": "1\" – SA H/M 025/028",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1\" – SA R/T 025/028",
    "unit": "20.15",
    "price": 46,
    "supplier": "1\" – SA R/T 025/028",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1/2\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 11.3,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1/2\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 11.3,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1/2\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 20,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1/2\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 20,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1/2\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 20,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1/2\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 35.09,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1/2\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 35.09,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1/2\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 43.17,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1/2\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 43.17,
    "supplier": "Intermil 11/05/2026",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1/2\" – SA H/M 012/015",
    "unit": "11.45",
    "price": 37,
    "supplier": "1/2\" – SA H/M 012/015",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1/2\" – SA R/T 012/015",
    "unit": "11.45",
    "price": 41,
    "supplier": "1/2\" – SA R/T 012/015",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1/4\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 9.7,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1/4\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 9.7,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1/4\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 9.7,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1/4\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 16.83,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1/4\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 16.83,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1/4\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 16.83,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "1/4\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 22.36,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1/4\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 22.36,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1/4\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 35.51,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "1/4\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 35.51,
    "supplier": "Não existe essa Bitola",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1/4\" – SA H/M 006/010",
    "unit": "11.45",
    "price": 36.5,
    "supplier": "1/4\" – SA H/M 006/010",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "1/4\" – SA R/T 006/010",
    "unit": "11.45",
    "price": 40,
    "supplier": "1/4\" – SA R/T 006/010",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "2 1/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 33.2,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "2 1/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 33.2,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "2 1/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 55.43,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "2 1/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 55.43,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "2 1/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 85.93,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "2 1/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 85.93,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "2 1/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 122.76,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "2 1/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 122.76,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "2 1/8\" – SA H/M 054/054",
    "unit": "49.45",
    "price": 53,
    "supplier": "2 1/8\" – SA H/M 054/054",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "2 1/8\" – SA R/T 054/054",
    "unit": "49.45",
    "price": 60.5,
    "supplier": "2 1/8\" – SA R/T 054/054",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "3/4\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 13.7,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "3/4\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 13.7,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "3/4\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 22.68,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "3/4\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 22.68,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "3/4\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 22.68,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "3/4\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 41.49,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "3/4\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 41.49,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "3/4\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 60.99,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "3/4\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 60.99,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "3/4\" – SA H/M 018/022",
    "unit": "14.75",
    "price": 39.5,
    "supplier": "3/4\" – SA H/M 018/022",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "3/4\" – SA R/T 018/022",
    "unit": "14.75",
    "price": 45,
    "supplier": "3/4\" – SA R/T 018/022",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "3/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 10.7,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "3/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 10.7,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "3/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 10.7,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "3/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 18.97,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "3/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 18.97,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "3/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 18.97,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "3/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 22.36,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "3/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 22.36,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "3/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 35.51,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "3/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 35.51,
    "supplier": "Intermil 11/05/2026",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "3/8\" – SA H/M 006/010",
    "unit": "11.45",
    "price": 36.5,
    "supplier": "3/8\" – SA H/M 006/010",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "3/8\" – SA R/T 006/010",
    "unit": "11.45",
    "price": 40,
    "supplier": "3/8\" – SA R/T 006/010",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "5/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 12.6,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "5/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 12.6,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "5/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 21.14,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "5/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 21.14,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "5/8\" - ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 21.14,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "5/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 37.46,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "5/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 37.46,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "5/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 55.87,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "5/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 55.87,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "5/8\" – SA H/M 012/015",
    "unit": "14.75",
    "price": 37,
    "supplier": "5/8\" – SA H/M 012/015",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "5/8\" – SA R/T 012/015",
    "unit": "14.75",
    "price": 41,
    "supplier": "5/8\" – SA R/T 012/015",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "7/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 14.8,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "7/8\" - ARMAFLEX H 13 MM",
    "unit": "m",
    "price": 14.8,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "7/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 44.07,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "7/8\" - ARMAFLEX R 32,5 MM",
    "unit": "m",
    "price": 44.07,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "7/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 64.89,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "7/8\" - ARMAFLEX T 45 MM",
    "unit": "m",
    "price": 64.89,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "7/8\" – SA H/M 018/022",
    "unit": "20.15",
    "price": 39.5,
    "supplier": "7/8\" – SA H/M 018/022",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "7/8\" – SA R/T 018/022",
    "unit": "20.15",
    "price": 45,
    "supplier": "7/8\" – SA R/T 018/022",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "7/8\"- ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 26.44,
    "supplier": "Intermil 03/06/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "7/8\"- ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 26.44,
    "supplier": "ITERMIL",
    "context": "Isolamento Especial"
  },
  {
    "category": "Isolamento",
    "item": "7/8\"- ARMAFLEX M 19 MM",
    "unit": "m",
    "price": 26.44,
    "supplier": "ITERMIL",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "Adesivo Armaflex 520 - 900ml",
    "unit": "unid.",
    "price": 115.47,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Adesivo Armaflex 520 - 900ml",
    "unit": "unid.",
    "price": 120,
    "supplier": "08/05/2024",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "ALTERNATIVA: Válvula de Balanceamento e Controle 2 vias indep. Pressão 1 1/2\"",
    "unit": "-",
    "price": 3243.52,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "ALTERNATIVA: Válvula de Balanceamento e Controle 2 vias indep. Pressão 1 1/4\"",
    "unit": "-",
    "price": 2480.28,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "ALTERNATIVA: Válvula de Balanceamento e Controle 2 vias indep. Pressão 2 1/2\"",
    "unit": "-",
    "price": 6408.56,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "ALTERNATIVA: Válvula de Balanceamento e Controle 2 vias indep. Pressão 2\"",
    "unit": "-",
    "price": 4589.86,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "ALTERNATIVA: Válvula de Balanceamento e Controle 2 vias indep. Pressão 3\"",
    "unit": "-",
    "price": 9596.8,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Dutos Flexivéis - 100 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 04\"",
    "unit": "pç",
    "price": 105,
    "supplier": "ITERMIL - 03/07/26",
    "context": "EX_AE"
  },
  {
    "category": "Isolamento",
    "item": "Dutos Flexivéis - 100 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 04\"",
    "unit": "pç",
    "price": 105,
    "supplier": "ITERMIL - 03/07/26",
    "context": "Pressurização"
  },
  {
    "category": "Isolamento",
    "item": "Dutos Flexivéis - 150 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 06\"",
    "unit": "pç",
    "price": 143,
    "supplier": "ITERMIL - 03/07/26",
    "context": "EX_AE"
  },
  {
    "category": "Isolamento",
    "item": "Dutos Flexivéis - 150 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 06\"",
    "unit": "pç",
    "price": 143,
    "supplier": "ITERMIL - 03/07/26",
    "context": "Pressurização"
  },
  {
    "category": "Isolamento",
    "item": "Dutos Flexivéis - 200 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 08\"",
    "unit": "pç",
    "price": 186,
    "supplier": "ITERMIL - 03/07/26",
    "context": "EX_AE"
  },
  {
    "category": "Isolamento",
    "item": "Dutos Flexivéis - 200 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 08\"",
    "unit": "pç",
    "price": 186,
    "supplier": "ITERMIL - 03/07/26",
    "context": "Pressurização"
  },
  {
    "category": "Isolamento",
    "item": "Dutos Flexivéis - 250 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 10\"",
    "unit": "pç",
    "price": 228,
    "supplier": "ITERMIL - 03/07/26",
    "context": "EX_AE"
  },
  {
    "category": "Isolamento",
    "item": "Dutos Flexivéis - 250 mm (unid c/ 10 m) - SEM ISOLAMENTO - ALUDEC 10\"",
    "unit": "pç",
    "price": 228,
    "supplier": "ITERMIL - 03/07/26",
    "context": "Pressurização"
  },
  {
    "category": "Isolamento",
    "item": "Dutos Flexivéis - 300 mm (unid c/ 10m) - SEM ISOLAMENTO - ALUDEC 12\"",
    "unit": "pç",
    "price": 287,
    "supplier": "ITERMIL - 03/07/26",
    "context": "EX_AE"
  },
  {
    "category": "Isolamento",
    "item": "Dutos Flexivéis - 300 mm (unid c/ 10m) - SEM ISOLAMENTO - ALUDEC 12\"",
    "unit": "pç",
    "price": 287,
    "supplier": "ITERMIL - 03/07/26",
    "context": "Pressurização"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 1\" - (ISOTUBO)",
    "unit": "m",
    "price": 3.97,
    "supplier": "FrioPeças - 07/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 1\" - (ISOTUBO)",
    "unit": "m",
    "price": 3.97,
    "supplier": "Dufrio - 07/05/2026",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 1/2\" - (ISOTUBO)",
    "unit": "m",
    "price": 1.98,
    "supplier": "Dufrio - 07/05/2026 - Preço de Faturamento direto",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 1/2\" - (ISOTUBO)",
    "unit": "m",
    "price": 1.98,
    "supplier": "Dufrio - 07/05/2026",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 1/4\" - (ISOTUBO)",
    "unit": "m",
    "price": 1.81,
    "supplier": "Dufrio - 07/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 1/4\" - (ISOTUBO)",
    "unit": "m",
    "price": 1.81,
    "supplier": "Dufrio - 07/05/2026",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 1/4\" - 10x6,4mm (ISOTUBO)",
    "unit": "m",
    "price": 1.81,
    "supplier": "Dufrio - 07/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 1/4\" - 10x6,4mm (ISOTUBO)",
    "unit": "m",
    "price": 1.81,
    "supplier": "Dufrio - 07/05/2026",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 3/4\" - (ISOTUBO)",
    "unit": "m",
    "price": 2.6,
    "supplier": "Dufrio - 07/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 3/4\" - (ISOTUBO)",
    "unit": "m",
    "price": 2.6,
    "supplier": "Dufrio - 07/05/2026",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 3/8\" - (ISOTUBO)",
    "unit": "m",
    "price": 1.8,
    "supplier": "Dufrio - 07/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 3/8\" - (ISOTUBO)",
    "unit": "m",
    "price": 1.8,
    "supplier": "Dufrio - 07/05/2026",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 3/8\" - 10x10mm (ISOTUBO)",
    "unit": "m",
    "price": 1.8,
    "supplier": "Dufrio - 07/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 3/8\" - 10x10mm (ISOTUBO)",
    "unit": "m",
    "price": 1.8,
    "supplier": "Dufrio - 07/05/2026",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 5/8\" - (ISOTUBO)",
    "unit": "m",
    "price": 2.95,
    "supplier": "Dufrio - 07/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 5/8\" - (ISOTUBO)",
    "unit": "m",
    "price": 2.95,
    "supplier": "Dufrio - 07/05/2026",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 7/8\" - (ISOTUBO)",
    "unit": "m",
    "price": 3.69,
    "supplier": "FrioPeças - 07/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido - 7/8\" - (ISOTUBO)",
    "unit": "m",
    "price": 3.69,
    "supplier": "Dufrio - 07/05/2026",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido- 1 1/8\" - (ISOTUBO)",
    "unit": "m",
    "price": 3.57,
    "supplier": "FrioPeças - 07/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Espuma Polietileno Expandido- 1 1/8\" - (ISOTUBO)",
    "unit": "m",
    "price": 3.57,
    "supplier": "Dufrio - 07/05/2026",
    "context": "Isolamento Padrão"
  },
  {
    "category": "Isolamento",
    "item": "Fita Armaflex m",
    "unit": "unid.",
    "price": 93.33,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Fita Armaflex m - Rolo c/ 15 metros",
    "unit": "unid.",
    "price": 95,
    "supplier": "08/05/2023",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Armaduct - Espuma Elastomérica - 10mm",
    "unit": "m²",
    "price": 230,
    "supplier": "Itermil 17/07/26",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Armaduct - Espuma Elastomérica - 10mm",
    "unit": "m²",
    "price": 130,
    "supplier": "Itermil 17/07/26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Fibra Cerâmica - 38 mm - 96 kg/m3 - 3,05m² (Caso seja solicitado camada dupla, multiplicar por 2)",
    "unit": "m²",
    "price": 130.5,
    "supplier": "Itermil 20-07-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Fibra Cerâmica - 38 mm - 96 kg/m3 - 3,05m² (Caso seja solicitado camada dupla, multiplicar por 2)",
    "unit": "m²",
    "price": 130.5,
    "supplier": "Itermil 20-07-26",
    "context": "EX_AE"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Fibra Cerâmica - 38 mm - 96 kg/m3 - 3,05m² (Caso seja solicitado camada dupla, multiplicar por 2)",
    "unit": "m²",
    "price": 130.5,
    "supplier": "Itermil 20-07-26",
    "context": "Pressurização"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Flexliner - 25mm",
    "unit": "m²",
    "price": 80,
    "supplier": "---",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Flexliner - 25mm",
    "unit": "m²",
    "price": 80,
    "supplier": "03/07/2026 Refrin",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Lã de Rocha - 50mm - 32KG - 9,6m²(Caso seja solicitado camada dupla, multiplicar por 2)",
    "unit": "m²",
    "price": 37,
    "supplier": "Itermil 20-07-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Lã de Rocha - 50mm - 32KG - 9,6m²(Caso seja solicitado camada dupla, multiplicar por 2)",
    "unit": "m²",
    "price": 37,
    "supplier": "Itermil 20-07-26",
    "context": "EX_AE"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Lã de Rocha - 50mm - 32KG - 9,6m²(Caso seja solicitado camada dupla, multiplicar por 2)",
    "unit": "m²",
    "price": 37,
    "supplier": "Itermil 20-07-26",
    "context": "Pressurização"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Lã de vidro - 38mm",
    "unit": "m²",
    "price": 25,
    "supplier": "Itermil 17/07/26",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Lã de vidro - 38mm",
    "unit": "m²",
    "price": 25,
    "supplier": "Itermil 17/07/26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Manta Armaflex 32mm (Tubulações acima de 8\")",
    "unit": "m²",
    "price": 200.401,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Polipex - 10mm",
    "unit": "m²",
    "price": 85,
    "supplier": "Itermil 17/07/26",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Polipex - 10mm",
    "unit": "m²",
    "price": 100,
    "supplier": "Itermil 17/07/26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Polipex - 15mm",
    "unit": "m²",
    "price": 135,
    "supplier": "Itermil 17/07/26",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Polipex - 15mm",
    "unit": "m²",
    "price": 145,
    "supplier": "Itermil 17/07/26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Tubulação Armaflex - 1 1/2\" - AF-T-48",
    "unit": "m",
    "price": 114.43,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Tubulação Armaflex - 1 1/4\" - AF-T-42",
    "unit": "m",
    "price": 102.59,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Tubulação Armaflex - 1\" - AF-T-35",
    "unit": "m",
    "price": 88.14,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Tubulação Armaflex - 2 1/2\" -AF-T-76",
    "unit": "m",
    "price": 168.44,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Tubulação Armaflex - 2\" - AF-T-60",
    "unit": "m",
    "price": 135.6,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Tubulação Armaflex - 3\" - AF-T-89",
    "unit": "m",
    "price": 190.6,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Tubulação Armaflex - 3/4\" - AF-T-28",
    "unit": "m",
    "price": 75.79,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Tubulação Armaflex - 4\" - AF-T-114",
    "unit": "m",
    "price": 235.29,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Tubulação Armaflex - 5\" - AF-T-140",
    "unit": "m",
    "price": 285.53,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Isolamento Tubulação Armaflex - 6\" AF-T-168",
    "unit": "m",
    "price": 338.78,
    "supplier": "Armacell - 2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Porca e arruela de 1/4 pol.",
    "unit": "pç",
    "price": 0.18,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Porca e arruela de 1/4 pol.",
    "unit": "pç",
    "price": 0.18,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Porca e arruela de 1/4 pol.",
    "unit": "pç",
    "price": 0.18,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Isolamento",
    "item": "Porca e arruela de 1/4 pol.",
    "unit": "pç",
    "price": 0.18,
    "supplier": "01/07/2026",
    "context": "EX_AE"
  },
  {
    "category": "Isolamento",
    "item": "Porca e arruela de 1/4 pol.",
    "unit": "pç",
    "price": 0.3,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Isolamento",
    "item": "Porca e arruela de 5/16 pol.",
    "unit": "pç",
    "price": 0.3,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Isolamento",
    "item": "Porca e arruela de 5/16 pol.",
    "unit": "pç",
    "price": 0.3,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Porca e arruela de 5/16 pol.",
    "unit": "pç",
    "price": 0.3,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Isolamento",
    "item": "Porca e arruela de 5/16 pol.",
    "unit": "pç",
    "price": 0.3,
    "supplier": "01/07/2026",
    "context": "EX_AE"
  },
  {
    "category": "Isolamento",
    "item": "Porca e arruela de 5/16 pol.",
    "unit": "pç",
    "price": 0.35,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de balanceamento - 5\"",
    "unit": "unid",
    "price": 10721.9,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de balanceamento - 6\"",
    "unit": "unid",
    "price": 5576.02,
    "supplier": "By Import - 03-07-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de balanceamento - 6\"",
    "unit": "unid",
    "price": 15835.6,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de balanceamento do diâmetro",
    "unit": "Unid.",
    "price": 436.31,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de balanceamento do diâmetro",
    "unit": "Unid.",
    "price": 487.57,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de balanceamento do diâmetro - 1 1/2\"",
    "unit": "-",
    "price": 511.27,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de balanceamento do diâmetro - 1 1/4\"",
    "unit": "-",
    "price": 482.02,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de balanceamento do diâmetro - 2 1/2\"",
    "unit": "-",
    "price": 1815.69,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de balanceamento do diâmetro - 2\"",
    "unit": "-",
    "price": 1134.64,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de balanceamento do diâmetro - 3\"",
    "unit": "-",
    "price": 3345.59,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de bloqueio - 5\" - Valvula Gaveta, Aço Carbono com flange 5\"",
    "unit": "unid",
    "price": 5491.2,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de bloqueio - 6\" - Valvula Gaveta, Aço Carbono com flange 6\"",
    "unit": "unid",
    "price": 6858,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de Bloqueio Tipo Esfera 1\"",
    "unit": "Unid.",
    "price": 58,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de Bloqueio Tipo Esfera 3/4\"",
    "unit": "Unid.",
    "price": 27,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de controle 2 vias com atuador e termostato do diâmetro - 1 1/2\"",
    "unit": "-",
    "price": 2660.61,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de controle 2 vias com atuador e termostato do diâmetro - 1 1/4\"",
    "unit": "-",
    "price": 2108.44,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de controle 2 vias com atuador e termostato do diâmetro - 2 1/2\"",
    "unit": "-",
    "price": 4164.08,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de controle 2 vias com atuador e termostato do diâmetro - 2\"",
    "unit": "-",
    "price": 2760.91,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de controle 2 vias com atuador e termostato do diâmetro - 3\"",
    "unit": "-",
    "price": 4592.75,
    "supplier": "BY IMPORT 03/04/23",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Isolamento",
    "item": "Válvula de retenção dupla portinhola, wafer flangeada - 5\"",
    "unit": "unid",
    "price": 1374,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Linha frigorígena",
    "item": "1 1/2\" – 38,1mm – e=1/16\" tubulação de cobre RÍGIDO",
    "unit": "m",
    "price": 252.805,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "1 1/4\" – 31,75mm – e=1/16\" tubulação de cobre RÍGIDO",
    "unit": "m",
    "price": 208.785,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "1 1/8\" – 28,6mm – e=1/16\" tubulação de cobre RÍGIDO",
    "unit": "m",
    "price": 186.775,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "1 3/8\" – 34,9mm – e=1/16\" tubulação de cobre RÍGIDO",
    "unit": "m",
    "price": 230.795,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "1 5/8\" – 41,3mm – e=1/16\" tubulação de cobre RÍGIDO",
    "unit": "m",
    "price": 274.35,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "1\" – 25,4mm – e=1/16\" tubulação de cobre RÍGIDO",
    "unit": "m",
    "price": 164.92,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "1.3/4\" – 44,45mm – e=1/16\" tubulação de cobre RÍGIDO",
    "unit": "m",
    "price": 296.67,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "1/2\" – 12,7mm – e=1/32\" tubulação de cobre FLEXIVÉL",
    "unit": "m",
    "price": 67.095,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "1/4\" - 6,35mm – e= 1/32\" tubulação de cobre FLEXIVÉL",
    "unit": "m",
    "price": 28.755,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "3/4\" – 19,05mm – e=1/16\" tubulação de cobre RÍGIDO",
    "unit": "m",
    "price": 120.9,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "3/8\" – 9,53mm – e=1/32\" tubulação de cobre FLEXIVEL",
    "unit": "m",
    "price": 47.925,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "5/8\" – 15,88mm – e=1/16\" tubulação de cobre FLEXIVÉL/RÍGIDO",
    "unit": "m",
    "price": 86.13,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "7/8\" - 22,2mm – e=1/16\" tubulação de cobre RÍGIDO",
    "unit": "m",
    "price": 142.91,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "CABINHO PP 4x2,5mm²",
    "unit": "m",
    "price": 13.3745,
    "supplier": "11/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Capacidade Total das Evaporadoras (HP) — Utilizado na Ausência de Caminhamento de cobre",
    "unit": "HP",
    "price": 2800,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Cobre flexível",
    "unit": "kg",
    "price": 135,
    "supplier": "04/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Cobre rígido",
    "unit": "kg",
    "price": 155,
    "supplier": "04/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "FITA PVC BRANCA - Rolo",
    "unit": "m",
    "price": 3.519,
    "supplier": "11/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Refrigerante (Garrafa 11KG) - DUPOINT",
    "unit": "pç",
    "price": 1600,
    "supplier": "08/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Refrigerante (Garrafa 11KG) - DUPOINT",
    "unit": "pç",
    "price": 1600,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Refrigerante R410 (Garrafa 11KG) (Ver no catálogo do fabricante)",
    "unit": "VB",
    "price": 1600,
    "supplier": "08/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Tubulação de Cobre - 1 1/8\" Rígido -1/32\"",
    "unit": "m",
    "price": 186.775,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Tubulação de Cobre - 1\" Rígido - 1/32\"",
    "unit": "m",
    "price": 164.92,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Tubulação de Cobre - 1/2\" - 1/32\"",
    "unit": "m",
    "price": 35.91,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Tubulação de Cobre - 1/4\" - 1/32\"",
    "unit": "m",
    "price": 16.74,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Tubulação de Cobre - 3/4\" Rígido - 1/32\"",
    "unit": "m",
    "price": 120.9,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Tubulação de Cobre - 3/8\" - 1/32\"",
    "unit": "m",
    "price": 26.325,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Tubulação de Cobre - 5/8\" - 1/32\"",
    "unit": "m",
    "price": 45.495,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Tubulação de Cobre - 7/8\" Rígido - 1/32\"",
    "unit": "m",
    "price": 142.91,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Tubulação de Cobre Flexivel - 1/4\" - 1/32\"",
    "unit": "m",
    "price": 16.74,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Tubulação de Cobre Flexível",
    "unit": "-",
    "price": 135,
    "supplier": "30/06/2026 - DUFRIO",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Tubulação de Cobre Flexível",
    "unit": "kg",
    "price": 135,
    "supplier": "04/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Tubulação de Cobre Rígido",
    "unit": "-",
    "price": 155,
    "supplier": "30/06/2026 - DUFRIO",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Linha frigorígena",
    "item": "Tubulação de Cobre Rígido",
    "unit": "kg",
    "price": 155,
    "supplier": "04/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (fabricação e montagem)",
    "unit": "m²",
    "price": 100,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (fabricação e montagem)",
    "unit": "m linear",
    "price": 150,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (fabricação e montagem)",
    "unit": "m²",
    "price": 100,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (fabricação e montagem)",
    "unit": "m linear",
    "price": 150,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (Fabricação) - Exaustão e Ventilação",
    "unit": "KG",
    "price": 4,
    "supplier": "---",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (Fabricação) - Exaustão e Ventilação",
    "unit": "KG",
    "price": 4,
    "supplier": "---",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (Fabricação) - Exaustão e Ventilação",
    "unit": "KG",
    "price": 4,
    "supplier": "---",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (Fabricação) - Insuflamento e Retorno",
    "unit": "KG",
    "price": 4,
    "supplier": "---",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (Fabricação) - Insuflamento e Retorno",
    "unit": "KG",
    "price": 4,
    "supplier": "---",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (Instalação) - Exaustão e Ventilação",
    "unit": "KG",
    "price": 15,
    "supplier": "---",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (Instalação) - Exaustão e Ventilação",
    "unit": "KG",
    "price": 15,
    "supplier": "---",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (Instalação) - Exaustão e Ventilação",
    "unit": "KG",
    "price": 18,
    "supplier": "---",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (Instalação) - Insuflamento e Retorno",
    "unit": "KG",
    "price": 15,
    "supplier": "---",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro (Instalação) - Insuflamento e Retorno",
    "unit": "KG",
    "price": 15,
    "supplier": "---",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro + Soldador (Fabricação) - Exaustão Chapa Preta",
    "unit": "KG",
    "price": 8,
    "supplier": "---",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro + Soldador (Fabricação) - Exaustão Chapa Preta",
    "unit": "KG",
    "price": 8,
    "supplier": "---",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro + Soldador (Instalação) - Exaustão Chapa Preta",
    "unit": "KG",
    "price": 20,
    "supplier": "---",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiro + Soldador (Instalação) - Exaustão Chapa Preta",
    "unit": "KG",
    "price": 20,
    "supplier": "---",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiros - Preço Fixo Caso seja pouco duto",
    "unit": "vb",
    "price": 6000,
    "supplier": "---",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiros - Preço Fixo Caso seja pouco duto",
    "unit": "vb",
    "price": 8000,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiros - Preço Fixo Caso seja pouco duto",
    "unit": "vb",
    "price": 8000,
    "supplier": "---",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiros - Preço Fixo Caso seja pouco duto",
    "unit": "vb",
    "price": 8000,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiros - Preço Fixo Caso seja pouco duto",
    "unit": "vb",
    "price": 8000,
    "supplier": "---",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiros - Preço Fixo Caso seja pouco duto - abaixo de 200 KG",
    "unit": "vb",
    "price": 8000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Duteiros - Preço Fixo Caso seja pouco duto - abaixo de 200 KG",
    "unit": "vb",
    "price": 8000,
    "supplier": "---",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "09.000 a 12.000 Btu/h | unid",
    "price": 630,
    "supplier": "-",
    "context": "AC Direta - tabela simplificada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "18.000 a 22.000 Btu/h | unid",
    "price": 840,
    "supplier": "-",
    "context": "AC Direta - tabela simplificada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "30.000 a 36.000 Btu/h | unid",
    "price": 980,
    "supplier": "-",
    "context": "AC Direta - tabela simplificada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "48.000 a 60.000 Btu/h | unid",
    "price": 1120,
    "supplier": "-",
    "context": "AC Direta - tabela simplificada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "Built In | 09.000 a 12.000 Btu/h | unid",
    "price": 1400,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "Built In | 18.000 a 22.000 Btu/h | unid",
    "price": 1600,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "Built In | 30.000 a 36.000 Btu/h | unid",
    "price": 1800,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "Built In | 48.000 a 60.000 Btu/h | unid",
    "price": 2000,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "Cassete | 09.000 a 12.000 Btu/h | unid",
    "price": 1200,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "Cassete | 18.000 a 22.000 Btu/h | unid",
    "price": 1400,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "Cassete | 30.000 a 36.000 Btu/h | unid",
    "price": 1600,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "Cassete | 48.000 a 60.000 Btu/h | unid",
    "price": 1800,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "Hi Wall | 09.000 a 12.000 Btu/h | unid",
    "price": 900,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "Hi Wall | 18.000 a 22.000 Btu/h | unid",
    "price": 1200,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "Piso Teto | 30.000 a 36.000 Btu/h | unid",
    "price": 1400,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Comercial",
    "unit": "Piso Teto | 48.000 a 60.000 Btu/h | unid",
    "price": 1600,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "09.000 a 12.000 Btu/h | unid",
    "price": 787.5,
    "supplier": "-",
    "context": "AC Direta - tabela simplificada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "18.000 a 22.000 Btu/h | unid",
    "price": 1050,
    "supplier": "-",
    "context": "AC Direta - tabela simplificada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "30.000 a 36.000 Btu/h | unid",
    "price": 1225,
    "supplier": "-",
    "context": "AC Direta - tabela simplificada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "48.000 a 60.000 Btu/h | unid",
    "price": 1400,
    "supplier": "-",
    "context": "AC Direta - tabela simplificada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "Built In | 09.000 a 12.000 Btu/h | unid",
    "price": 1750,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "Built In | 18.000 a 22.000 Btu/h | unid",
    "price": 2000,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "Built In | 30.000 a 36.000 Btu/h | unid",
    "price": 2250,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "Built In | 48.000 a 60.000 Btu/h | unid",
    "price": 2500,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "Cassete | 09.000 a 12.000 Btu/h | unid",
    "price": 1500,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "Cassete | 18.000 a 22.000 Btu/h | unid",
    "price": 1750,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "Cassete | 30.000 a 36.000 Btu/h | unid",
    "price": 2000,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "Cassete | 48.000 a 60.000 Btu/h | unid",
    "price": 2250,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "Hi Wall | 09.000 a 12.000 Btu/h | unid",
    "price": 1125,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "Hi Wall | 18.000 a 22.000 Btu/h | unid",
    "price": 1500,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "Piso Teto | 30.000 a 36.000 Btu/h | unid",
    "price": 1750,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Horario Extra",
    "unit": "Piso Teto | 48.000 a 60.000 Btu/h | unid",
    "price": 2000,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Cortina de Ar",
    "unit": "unid",
    "price": 800,
    "supplier": "29/12/25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Fechamento Hidráulico - 1 1/2\"",
    "unit": "unid",
    "price": 1200,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Fechamento Hidráulico - 1 1/4\"",
    "unit": "unid",
    "price": 1200,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Fechamento Hidráulico - 2 1/2\"",
    "unit": "unid",
    "price": 1200,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Fechamento Hidráulico - 2\"",
    "unit": "unid",
    "price": 1200,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Fechamento Hidráulico - 3\"",
    "unit": "unid",
    "price": 1200,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Fechamento Hidráulico - Bomba",
    "unit": "unid",
    "price": 5000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Fechamento Hidráulico - Chiller",
    "unit": "unid",
    "price": 5000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Fechamento Hidráulico - Torre",
    "unit": "unid",
    "price": 5000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Fechamento Hidráulico Fancolete",
    "unit": "Unid.",
    "price": 600,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Proteção Mecânica - Aluminio 0,7 mm",
    "unit": "m linear",
    "price": 80,
    "supplier": "JUVENAL",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Proteção Mecânica - Aluminio 0,7 mm",
    "unit": "m linear",
    "price": 80,
    "supplier": "JUVENAL",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Proteção Mecânica - Aluminio Corrugado 0,40 mm",
    "unit": "m linear",
    "price": 80,
    "supplier": "JUVENAL",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Proteção Mecânica - Fibraflex - de 2 1/2\" até 3\"",
    "unit": "m linear",
    "price": 90,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Proteção Mecânica - Fibraflex - de 3/4\" até 2\"",
    "unit": "m linear",
    "price": 70,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Tubulação Água Gelada - 2 1/2\" até 3\"",
    "unit": "m",
    "price": 150,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Tubulação Água Gelada - até 10\"",
    "unit": "m",
    "price": 200,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O - Tubulação Água Gelada - até 2\"",
    "unit": "m",
    "price": 120,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O. - Apenas Instalação",
    "unit": "kg",
    "price": 10,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "M.O. - Apenas Instalação",
    "unit": "M",
    "price": 10,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "M.O. - Apenas Instalação",
    "unit": "kg",
    "price": 35,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "M.O. - Apenas Instalação",
    "unit": "kg",
    "price": 10,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O. - Apenas Instalação",
    "unit": "M",
    "price": 10,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "M.O. - Apenas Instalação",
    "unit": "M",
    "price": 10,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "M.O. - Apenas Instalação",
    "unit": "M",
    "price": 10,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de obra",
    "unit": "unid.",
    "price": 120,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Apenas instalação do Equipamentos COIFA",
    "unit": "unid",
    "price": 800,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Apenas instalação do Equipamentos COIFA WASH PULL",
    "unit": "unid",
    "price": 2000,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Apenas instalação do Equipamentos EXAUSTOR AXIAIS (ACI, etc)",
    "unit": "unid",
    "price": 1000,
    "supplier": "29-12-25",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Apenas instalação do Equipamentos EXAUSTOR/CAIXA VENTILADORA",
    "unit": "unid",
    "price": 1500,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Apenas instalação do Equipamentos EXAUSTOR/CAIXA VENTILADORA",
    "unit": "unid",
    "price": 1500,
    "supplier": "29-12-25",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Apenas instalação do Equipamentos EXAUSTOR/CAIXA VENTILADORA",
    "unit": "unid",
    "price": 1500,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Apenas instalação do Equipamentos FANCOIL 12,5 a 25 TR",
    "unit": "unid",
    "price": 2000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Apenas instalação do Equipamentos FANCOIL acima 30 TR",
    "unit": "unid",
    "price": 2000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Apenas instalação do Equipamentos FANCOIL até 10 TR",
    "unit": "unid",
    "price": 1000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Apenas instalação do Equipamentos FANCOLETE",
    "unit": "unid",
    "price": 800,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Apenas instalação do Equipamentos FILTRO ELETROESTÁTICO",
    "unit": "unid",
    "price": 1500,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Apenas instalação do Equipamentos LAVADOR DE GASES",
    "unit": "unid",
    "price": 1500,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de obra - Esp. Elastomérica",
    "unit": "m²",
    "price": 50,
    "supplier": "---",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de obra - Esp. Elastomérica",
    "unit": "m²",
    "price": 50,
    "supplier": "---",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Caixa GSP",
    "unit": "unid",
    "price": 500,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Caixa GSP",
    "unit": "unid",
    "price": 500,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Caixa GSP",
    "unit": "unid",
    "price": 500,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Caixa GSP",
    "unit": "unid",
    "price": 500,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 01 motor",
    "unit": "unid",
    "price": 1700,
    "supplier": "L.J.D 160",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 01 motor",
    "unit": "unid",
    "price": 1700,
    "supplier": "L.J.D 160",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 01 motor",
    "unit": "unid",
    "price": 1700,
    "supplier": "L.J.D 160",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 01 motor",
    "unit": "unid",
    "price": 1700,
    "supplier": "L.J.D 160",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 03 motores",
    "unit": "unid",
    "price": 2800,
    "supplier": "L.J.D 160",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 03 motores",
    "unit": "unid",
    "price": 2800,
    "supplier": "L.J.D 160",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 03 motores",
    "unit": "unid",
    "price": 2800,
    "supplier": "L.J.D 160",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1 a 5CV para 03 motores",
    "unit": "unid",
    "price": 2800,
    "supplier": "L.J.D 160",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 01 motor com inversor",
    "unit": "unid",
    "price": 2300,
    "supplier": "L.J.D 160",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 01 motor com inversor",
    "unit": "unid",
    "price": 2300,
    "supplier": "L.J.D 160",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 01 motor com inversor",
    "unit": "unid",
    "price": 2300,
    "supplier": "L.J.D 160",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 01 motor com inversor",
    "unit": "unid",
    "price": 2300,
    "supplier": "L.J.D 160",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 03 motores com inversor",
    "unit": "unid",
    "price": 3000,
    "supplier": "L.J.D 160",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 03 motores com inversor",
    "unit": "unid",
    "price": 3000,
    "supplier": "L.J.D 160",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 03 motores com inversor",
    "unit": "unid",
    "price": 3000,
    "supplier": "L.J.D 160",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 1CV até 5CV para 03 motores com inversor",
    "unit": "unid",
    "price": 3000,
    "supplier": "L.J.D 160",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 01 motor com inversor",
    "unit": "unid",
    "price": 3500,
    "supplier": "L.J.D 160",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 01 motor com inversor",
    "unit": "unid",
    "price": 3500,
    "supplier": "L.J.D 160",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 01 motor com inversor",
    "unit": "unid",
    "price": 3500,
    "supplier": "L.J.D 160",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 01 motor com inversor",
    "unit": "unid",
    "price": 3500,
    "supplier": "L.J.D 160",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 03 motores com inversor",
    "unit": "unid",
    "price": 4500,
    "supplier": "L.J.D 160",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 03 motores com inversor",
    "unit": "unid",
    "price": 4500,
    "supplier": "L.J.D 160",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 03 motores com inversor",
    "unit": "unid",
    "price": 4500,
    "supplier": "L.J.D 160",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Instalação de Quadro Elétrico - 7,5CV até 15CV para 03 motores com inversor",
    "unit": "unid",
    "price": 4500,
    "supplier": "L.J.D 160",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Intertravamento",
    "unit": "unid",
    "price": 750,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Intertravamento",
    "unit": "unid",
    "price": 750,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Intertravamento",
    "unit": "unid",
    "price": 750,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra - Intertravamento",
    "unit": "unid",
    "price": 750,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra VRF — Condensadoras",
    "unit": "unid.",
    "price": 1000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra VRF — Evaporadoras + Infraestrutura",
    "unit": "HP",
    "price": 750,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra VRF — Evaporadoras + Infraestrutura",
    "unit": "Und",
    "price": 1000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Mão de Obra VRF — Somente Infraestrutura",
    "unit": "HP",
    "price": 550,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Preço Mão de Obra Unidade Condensadora (1 por sistema) (MO)",
    "unit": "Unid.",
    "price": 3000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Preço Mão de Obra Unidade Condensadora (1 por sistema) (MO) - ESPECIAIS",
    "unit": "Unid.",
    "price": 6000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Preço Mão de Obra Unidade Condensadora (2 por sistema) (MO)",
    "unit": "Unid.",
    "price": 6000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Preço Mão de Obra Unidade Condensadora (2 por sistema) (MO) - ESPECIAIS",
    "unit": "Unid.",
    "price": 12000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "09.000 a 12.000 Btu/h | unid",
    "price": 850.5,
    "supplier": "-",
    "context": "AC Direta - tabela simplificada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "18.000 a 22.000 Btu/h | unid",
    "price": 1134,
    "supplier": "-",
    "context": "AC Direta - tabela simplificada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "30.000 a 36.000 Btu/h | unid",
    "price": 1323,
    "supplier": "-",
    "context": "AC Direta - tabela simplificada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "48.000 a 60.000 Btu/h | unid",
    "price": 1512,
    "supplier": "-",
    "context": "AC Direta - tabela simplificada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "Built In | 09.000 a 12.000 Btu/h | unid",
    "price": 1890,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "Built In | 18.000 a 22.000 Btu/h | unid",
    "price": 2160,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "Built In | 30.000 a 36.000 Btu/h | unid",
    "price": 2430,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "Built In | 48.000 a 60.000 Btu/h | unid",
    "price": 2700,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "Cassete | 09.000 a 12.000 Btu/h | unid",
    "price": 1620,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "Cassete | 18.000 a 22.000 Btu/h | unid",
    "price": 1890,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "Cassete | 30.000 a 36.000 Btu/h | unid",
    "price": 2160,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "Cassete | 48.000 a 60.000 Btu/h | unid",
    "price": 2430,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "Hi Wall | 09.000 a 12.000 Btu/h | unid",
    "price": 1215,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "Hi Wall | 18.000 a 22.000 Btu/h | unid",
    "price": 1620,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "Piso Teto | 30.000 a 36.000 Btu/h | unid",
    "price": 1890,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Mão de obra",
    "item": "Residencial alto Padrão",
    "unit": "Piso Teto | 48.000 a 60.000 Btu/h | unid",
    "price": 2160,
    "supplier": "-",
    "context": "AC Direta - tabela detalhada"
  },
  {
    "category": "Outros",
    "item": "1 1/2\" – SA H/M 038/038",
    "unit": "unid",
    "price": 26.95,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 1/2\" – SA H/M 038/038",
    "unit": "unid",
    "price": 45,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 1/2\" – SA R/T 038/038",
    "unit": "unid",
    "price": 26.95,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 1/2\" – SA R/T 038/038",
    "unit": "unid",
    "price": 53,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 1/4\" – SA H/M 032/035",
    "unit": "unid",
    "price": 23.45,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 1/4\" – SA H/M 032/035",
    "unit": "unid",
    "price": 43,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 1/4\" – SA R/T 032/035",
    "unit": "unid",
    "price": 23.45,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 1/4\" – SA R/T 032/035",
    "unit": "unid",
    "price": 48.5,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 1/8\" – SA H/M 025/028",
    "unit": "unid",
    "price": 23.45,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 1/8\" – SA H/M 025/028",
    "unit": "unid",
    "price": 41,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 1/8\" – SA R/T 025/028",
    "unit": "unid",
    "price": 23.45,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 1/8\" – SA R/T 025/028",
    "unit": "unid",
    "price": 46,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 3/8\" – SA H/M 032/035",
    "unit": "unid",
    "price": 26.95,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 3/8\" – SA H/M 032/035",
    "unit": "unid",
    "price": 43,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 3/8\" – SA R/T 032/035",
    "unit": "unid",
    "price": 26.95,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 3/8\" – SA R/T 032/035",
    "unit": "unid",
    "price": 48.5,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 5/8\" – SA H/M 040/040",
    "unit": "unid",
    "price": 33.65,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 5/8\" – SA H/M 040/040",
    "unit": "unid",
    "price": 46,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 5/8\" – SA R/T 040/042",
    "unit": "unid",
    "price": 33.65,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 5/8\" – SA R/T 040/042",
    "unit": "unid",
    "price": 49.5,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 7/8\" – SA H/M 048/048",
    "unit": "unid",
    "price": 33.65,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 7/8\" – SA H/M 048/048",
    "unit": "unid",
    "price": 46.5,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 7/8\" – SA R/T 048/048",
    "unit": "unid",
    "price": 33.65,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1 7/8\" – SA R/T 048/048",
    "unit": "unid",
    "price": 60,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1\" – SA H/M 025/028",
    "unit": "unid",
    "price": 20.15,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1\" – SA H/M 025/028",
    "unit": "unid",
    "price": 41,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1\" – SA R/T 025/028",
    "unit": "unid",
    "price": 20.15,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1\" – SA R/T 025/028",
    "unit": "unid",
    "price": 46,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1/2\" – 12,7mm – e=1/32\"",
    "unit": "m",
    "price": 67.095,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1/2\" – SA H/M 012/015",
    "unit": "unid",
    "price": 11.45,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1/2\" – SA H/M 012/015",
    "unit": "unid",
    "price": 37,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1/2\" – SA R/T 012/015",
    "unit": "unid",
    "price": 11.45,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1/2\" – SA R/T 012/015",
    "unit": "unid",
    "price": 41,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1/4\" - 6,35mm – e= 1/32\"",
    "unit": "m",
    "price": 28.755,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1/4\" – SA H/M 006/010",
    "unit": "unid",
    "price": 11.45,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1/4\" – SA H/M 006/010",
    "unit": "unid",
    "price": 36.5,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1/4\" – SA R/T 006/010",
    "unit": "unid",
    "price": 11.45,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "1/4\" – SA R/T 006/010",
    "unit": "unid",
    "price": 40,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "2 1/8\"",
    "unit": "unid.",
    "price": 966,
    "supplier": "Danfoss 23/05",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "2 1/8\" – SA H/M 054/054",
    "unit": "unid",
    "price": 49.45,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "2 1/8\" – SA H/M 054/054",
    "unit": "unid",
    "price": 53,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "2 1/8\" – SA R/T 054/054",
    "unit": "unid",
    "price": 49.45,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "2 1/8\" – SA R/T 054/054",
    "unit": "unid",
    "price": 60.5,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "3/4\" – SA H/M 018/022",
    "unit": "unid",
    "price": 14.75,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "3/4\" – SA H/M 018/022",
    "unit": "unid",
    "price": 39.5,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "3/4\" – SA R/T 018/022",
    "unit": "unid",
    "price": 14.75,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "3/4\" – SA R/T 018/022",
    "unit": "unid",
    "price": 45,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "3/8\" – 9,53mm – e=1/32\"",
    "unit": "m",
    "price": 47.925,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "3/8\" – SA H/M 006/010",
    "unit": "unid",
    "price": 11.45,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "3/8\" – SA H/M 006/010",
    "unit": "unid",
    "price": 36.5,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "3/8\" – SA R/T 006/010",
    "unit": "unid",
    "price": 11.45,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "3/8\" – SA R/T 006/010",
    "unit": "unid",
    "price": 40,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "5/8\" – 15,88mm – e=1/32\"",
    "unit": "m",
    "price": 86.13,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "5/8\" – SA H/M 012/015",
    "unit": "unid",
    "price": 14.75,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "5/8\" – SA H/M 012/015",
    "unit": "unid",
    "price": 37,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "5/8\" – SA R/T 012/015",
    "unit": "unid",
    "price": 14.75,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "5/8\" – SA R/T 012/015",
    "unit": "unid",
    "price": 41,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "7/8\" – SA H/M 018/022",
    "unit": "unid",
    "price": 20.15,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "7/8\" – SA H/M 018/022",
    "unit": "unid",
    "price": 39.5,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "7/8\" – SA R/T 018/022",
    "unit": "unid",
    "price": 20.15,
    "supplier": "24-06-2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "7/8\" – SA R/T 018/022",
    "unit": "unid",
    "price": 45,
    "supplier": "Sharing - 29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "ADBR 30 100 EA ALU MANTA ARMADUCT 30MM METALIZADA E ADESIVADA (RL C/ 7M2)",
    "unit": "m²",
    "price": 372,
    "supplier": "Itermil 20-07-26",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "ADBR 30 100 EA ALU MANTA ARMADUCT 30MM METALIZADA E ADESIVADA (RL C/ 7M2)",
    "unit": "m²",
    "price": 372,
    "supplier": "Itermil 20-07-26",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "ADBR 30 100 EA ALU MANTA ARMADUCT 30MM METALIZADA E ADESIVADA (RL C/ 7M2)",
    "unit": "m²",
    "price": 372,
    "supplier": "Itermil 20-07-26",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Andaime (caso seja necessário)",
    "unit": "mês",
    "price": 1200,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Andaime (caso seja necessário)",
    "unit": "mês",
    "price": 1200,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Andaime (caso seja necessário)",
    "unit": "mês",
    "price": 600,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Andaime (caso seja necessário)",
    "unit": "mês",
    "price": 600,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Andaime (caso seja necessário)",
    "unit": "mês",
    "price": 600,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Argamassa ACF",
    "unit": "Balde (50kg)",
    "price": 800,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Argamassa RST",
    "unit": "Balde (20kg)",
    "price": 1456,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Atuador On Off - 1\"",
    "unit": "und",
    "price": 1629.68,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Atuador On Off - 3/4\"",
    "unit": "und",
    "price": 1629.68,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Atuador Proporcional 1 1/2\"",
    "unit": "-",
    "price": 2286.71,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Atuador Proporcional 1 1/4\"",
    "unit": "-",
    "price": 2286.71,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Atuador Proporcional 2 1/2\"",
    "unit": "-",
    "price": 2286.71,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Atuador Proporcional 2\"",
    "unit": "-",
    "price": 2286.71,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Atuador Proporcional 3\"",
    "unit": "-",
    "price": 2286.71,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Bandeja",
    "unit": "Unid.",
    "price": 300,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Bandeja",
    "unit": "-",
    "price": 500,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Barra Rosqueada de 1/4 pol.",
    "unit": "m",
    "price": 4.485,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Barra Rosqueada de 1/4 pol.",
    "unit": "m",
    "price": 4.485,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Barra Rosqueada de 1/4 pol.",
    "unit": "m",
    "price": 4.485,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Barra Rosqueada de 1/4 pol.",
    "unit": "m",
    "price": 4.485,
    "supplier": "01/07/2026",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Barra Rosqueada de 1/4 pol.",
    "unit": "m",
    "price": 5,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Barra Rosqueada de 5/16 pol.",
    "unit": "m",
    "price": 7.26,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Barra Rosqueada de 5/16 pol.",
    "unit": "m",
    "price": 7.26,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Barra Rosqueada de 5/16 pol.",
    "unit": "m",
    "price": 7.26,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Barra Rosqueada de 5/16 pol.",
    "unit": "m",
    "price": 7.26,
    "supplier": "01/07/2026",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Barra Rosqueada de 5/16 pol.",
    "unit": "m",
    "price": 6.66,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Bombas - 5\"",
    "unit": "Unid",
    "price": 38154,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Cabo Comunicação",
    "unit": "m",
    "price": 9.5,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Cabo de Comunicação Shieldado 3x",
    "unit": "m",
    "price": 9.5,
    "supplier": "08/05/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Caixa de MPU (Pedir com acessórios) - PAINEL MPU 10MMX2,0MX1,2M(2,4m2) - 20 UNID POR CAIXA",
    "unit": "unid",
    "price": 4000,
    "supplier": "07-07-26",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Caixa de MPU (Pedir com acessórios) - PAINEL MPU 10MMX2,0MX1,2M(2,4m2) - 20 UNID POR CAIXA",
    "unit": "unid",
    "price": 4000,
    "supplier": "07-07-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Caixa de MPU (Pedir com acessórios) - PAINEL MPU 20MMX2,0MX1,2M(2,4M2) - 10 UNID POR CAIXA",
    "unit": "unid",
    "price": 2500,
    "supplier": "07-07-26",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Caixa de MPU (Pedir com acessórios) - PAINEL MPU 20MMX2,0MX1,2M(2,4M2) - 10 UNID POR CAIXA",
    "unit": "unid",
    "price": 2500,
    "supplier": "07-07-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Caixa de MPU (Pedir com acessórios) - PAINEL MPU 30MMX2,0MX1,2(2,4M2) - 7 UNID POR CAIXA",
    "unit": "unid",
    "price": 2600,
    "supplier": "07-07-26",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Caixa de MPU (Pedir com acessórios) - PAINEL MPU 30MMX2,0MX1,2(2,4M2) - 7 UNID POR CAIXA",
    "unit": "unid",
    "price": 2600,
    "supplier": "07-07-26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Calço Antivibração para Equipamentos de Grande Porte (Kit c/ 4 un.)",
    "unit": "unid",
    "price": 1000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Calço Antivibração para Equipamentos de Grande Porte (Kit c/ 4 un.)",
    "unit": "unid",
    "price": 1200,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Cantoneira 1 1/2 x 1/8pol.",
    "unit": "m",
    "price": 90,
    "supplier": "TENAX 02/03/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Cantoneira 1 1/4 x 1/8pol.",
    "unit": "m",
    "price": 90,
    "supplier": "TENAX 02/03/2026",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Cantos para perfil",
    "unit": "pç",
    "price": 1.17,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Cantos para perfil",
    "unit": "pç",
    "price": 1.17,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Cantos para perfil",
    "unit": "pç",
    "price": 1.17,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Cantos para perfil",
    "unit": "pç",
    "price": 1.17,
    "supplier": "01/07/2026",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Cantos para perfil",
    "unit": "pç",
    "price": 1.3,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Carro (Strada)",
    "unit": "mês",
    "price": 3000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Carro (Strada)",
    "unit": "mês",
    "price": 3000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Carro (Strada)",
    "unit": "mês",
    "price": 3000,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Carro (Strada)",
    "unit": "mês",
    "price": 3000,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Carro (Strada)",
    "unit": "mês",
    "price": 3000,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Chiller - 5\"",
    "unit": "Unid",
    "price": 107847.68,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Chiller - 6\"",
    "unit": "Unid",
    "price": 133615.6,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Chumbador de 1/4 pol. (Cone e Jaqueta)",
    "unit": "pç",
    "price": 0.765,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Chumbador de 1/4 pol. (Cone e Jaqueta)",
    "unit": "pç",
    "price": 0.765,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Chumbador de 1/4 pol. (Cone e Jaqueta)",
    "unit": "pç",
    "price": 0.765,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Chumbador de 1/4 pol. (Cone e Jaqueta)",
    "unit": "pç",
    "price": 0.765,
    "supplier": "01/07/2026",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Chumbador de 1/4 pol. (Cone e Jaqueta)",
    "unit": "pç",
    "price": 1,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Chumbador de 5/16 pol. (Cone e Jaqueta)",
    "unit": "pç",
    "price": 1.35,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Chumbador de 5/16 pol. (Cone e Jaqueta)",
    "unit": "pç",
    "price": 1.35,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Chumbador de 5/16 pol. (Cone e Jaqueta)",
    "unit": "pç",
    "price": 1.35,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Chumbador de 5/16 pol. (Cone e Jaqueta)",
    "unit": "pç",
    "price": 1.35,
    "supplier": "01/07/2026",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Chumbador de 5/16 pol. (Cone e Jaqueta)",
    "unit": "pç",
    "price": 1.3,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Componente A",
    "unit": "KG",
    "price": 55,
    "supplier": "INTERMIL",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Componente A",
    "unit": "kg",
    "price": 55,
    "supplier": "INTERMIL",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Componente B",
    "unit": "KG",
    "price": 55,
    "supplier": "INTERMIL",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Componente B",
    "unit": "kg",
    "price": 55,
    "supplier": "INTERMIL",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Cálcio Anti Vibração para Máquinas de Grande Porte (kit com 4)",
    "unit": "unid",
    "price": 1200,
    "supplier": "29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Cálcio Anti Vibração para Máquinas de Grande Porte (kit com 4)",
    "unit": "unid",
    "price": 1200,
    "supplier": "29-12-25",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Cálcio Anti Vibração para Máquinas de Grande Porte (kit com 4)",
    "unit": "unid",
    "price": 1200,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Cálcio Anti Vibração para Máquinas de Grande Porte (kit com 4)",
    "unit": "unid",
    "price": 1200,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Cálcio Anti Vibração para Máquinas de Grande Porte (kit com 4)",
    "unit": "unid",
    "price": 1200,
    "supplier": "29-12-25",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Cálcio Anti Vibração para Máquinas de Grande Porte (kit com 4)",
    "unit": "unid",
    "price": 1200,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Energy valve - 6\"",
    "unit": "unid",
    "price": 76570,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "FANCOIL - 1 1/2\"",
    "unit": "Unid",
    "price": 12306.51,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "FANCOIL - 1 1/4\"",
    "unit": "Unid",
    "price": 10739.85,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "FANCOIL - 2 1/2\"",
    "unit": "Unid",
    "price": 20645.84,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "FANCOIL - 2\"",
    "unit": "Unid",
    "price": 14963.32,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "FANCOIL - 3\"",
    "unit": "Unid",
    "price": 26786.25,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Fancolete - 1\"",
    "unit": "-",
    "price": 5815.83,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Fancolete - 3/4\"",
    "unit": "-",
    "price": 5402.16,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Fechamento",
    "unit": "unid",
    "price": 200,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Fechamento",
    "unit": "unid",
    "price": 200,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Fita aluminizada - Rolo com 50m",
    "unit": "pç",
    "price": 5,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Fita aluminizada - Rolo com 50m",
    "unit": "pç",
    "price": 5,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Fita aluminizada - Rolo com 50m",
    "unit": "pç",
    "price": 5,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Fita aluminizada - Rolo com 50m",
    "unit": "pç",
    "price": 5,
    "supplier": "01/07/2026",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Flange sobreposta, aço carbono ANSI-150-LBS-RF - 5\"",
    "unit": "unid",
    "price": 496.8,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Grampo com parafuso",
    "unit": "pç",
    "price": 2,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Grampo com parafuso",
    "unit": "pç",
    "price": 2,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Grampo com parafuso",
    "unit": "pç",
    "price": 2,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Grampo com parafuso",
    "unit": "pç",
    "price": 2,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Grampo com parafuso",
    "unit": "pç",
    "price": 2,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "GSP - até 1 CV",
    "unit": "unid",
    "price": 700,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "GSP - até 1 CV",
    "unit": "unid",
    "price": 700,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "GSP - até 1 CV",
    "unit": "unid",
    "price": 700,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "GSP - até 1 CV",
    "unit": "unid",
    "price": 700,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Horario Comercial",
    "unit": "Hi Wall | 09.000 a 12.000 Btu/h | unid",
    "price": 900,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Infra (distância até o ponto mais distante)",
    "unit": "mts",
    "price": 40,
    "supplier": "Services BR",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Interligações Elétricas",
    "unit": "unid",
    "price": 1500,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Isolador",
    "unit": "M2",
    "price": 60,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Isolador",
    "unit": "m²",
    "price": 60,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Junta flexível tipo Dynatecnica - 5\"",
    "unit": "unid",
    "price": 650,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Junta flexível tipo Dynatecnica - 6\"",
    "unit": "unid",
    "price": 735,
    "supplier": "SOUZA ALVEZ 03/07/26",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Mangote 1\" - 50cm",
    "unit": "Unid.",
    "price": 900,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Mangote 3/4\" - 50cm",
    "unit": "Unid.",
    "price": 700,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Outros",
    "unit": "SPLIT",
    "price": 300,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Pano / Trapo - 01 unid. Limpa 10m²",
    "unit": "unid",
    "price": 4.5,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Pano / Trapo - 01 unid. Limpa 10m²",
    "unit": "unid",
    "price": 4.5,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Pano / Trapo - 01 unid. Limpa 10m²",
    "unit": "unid",
    "price": 4.5,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Pano / Trapo - 01 unid. Limpa 10m²",
    "unit": "unid",
    "price": 4.5,
    "supplier": "01/07/2026",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Pano / Trapo - 01 unid. Limpa 10m²",
    "unit": "unid",
    "price": 3,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Perfilado",
    "unit": "m",
    "price": 22.095,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Perfilado",
    "unit": "m",
    "price": 22.095,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Perfilado",
    "unit": "m",
    "price": 22.095,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Perfilado",
    "unit": "m",
    "price": 22.095,
    "supplier": "01/07/2026",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Perfilado",
    "unit": "m",
    "price": 14,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Polietileno Expandido - 10mm",
    "unit": "m²",
    "price": 150,
    "supplier": "---",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Polietileno Expandido - 10mm",
    "unit": "m²",
    "price": 150,
    "supplier": "---",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Porca e parafuso - 5/16",
    "unit": "pç",
    "price": 0.6,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Porca e parafuso - 5/16",
    "unit": "pç",
    "price": 0.6,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Porca e parafuso - 5/16",
    "unit": "pç",
    "price": 0.6,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Porca e parafuso - 5/16",
    "unit": "pç",
    "price": 0.6,
    "supplier": "01/07/2026",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Porca e parafuso - 5/16",
    "unit": "pç",
    "price": 1,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Porcas e parafusos 5/16",
    "unit": "pç",
    "price": 1,
    "supplier": "46204",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Porcas e parafusos 5/16",
    "unit": "pç",
    "price": 1,
    "supplier": "46204",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "POÇO PARA TERMOMETRO, 1/2\" x 1/2\" x 50mm",
    "unit": "-",
    "price": 114,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Proteção Mecânica - Aluminio Liso 0,7 mm",
    "unit": "m²",
    "price": 130,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Proteção Mecânica - Aluminio Liso 0,7 mm",
    "unit": "m²",
    "price": 130,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Proteção Mecânica - ALUMÍNIO CORRUGADO ESP. 0,40MM - CORRUGAÇÃO 3/16\" SEM BARREIRA",
    "unit": "m²",
    "price": 70,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Remanejamento",
    "unit": "m linear",
    "price": 150,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Residencial alto Padrão",
    "unit": "18.000 a 22.000 Btu/h | unid",
    "price": 1134,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Saco de lixo de 100L/m²",
    "unit": "unid",
    "price": 1.5,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Saco de lixo de 100L/m²",
    "unit": "unid",
    "price": 1.5,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Saco de lixo de 100L/m²",
    "unit": "unid",
    "price": 1.5,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Saco de lixo de 100L/m²",
    "unit": "unid",
    "price": 1.5,
    "supplier": "01/07/2026",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Saco de lixo de 100L/m²",
    "unit": "unid",
    "price": 1,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "Selo plástico",
    "unit": "pç",
    "price": 0.2,
    "supplier": "01/07/2026",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Selo plástico",
    "unit": "pç",
    "price": 0.2,
    "supplier": "01/07/2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Selo plástico",
    "unit": "pç",
    "price": 0.2,
    "supplier": "01/07/2026",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Selo plástico",
    "unit": "pç",
    "price": 0.2,
    "supplier": "01/07/2026",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "TAB",
    "unit": "diária",
    "price": 1000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "TAB",
    "unit": "diária",
    "price": 1000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "TAB",
    "unit": "diária",
    "price": 1000,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "TAB",
    "unit": "diária",
    "price": 1000,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "TERMOMETRO CAPELA RETO, 0 à 50ºC, HASTE DE 50mm, ROSCA DE 1/2\"",
    "unit": "-",
    "price": 468,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Teste de estanqueidade",
    "unit": "diária",
    "price": 5000,
    "supplier": "-",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Teste de estanqueidade",
    "unit": "diária",
    "price": 5000,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Teste de estanqueidade",
    "unit": "diária",
    "price": 5000,
    "supplier": "-",
    "context": "EX Cozinha"
  },
  {
    "category": "Outros",
    "item": "Teste de estanqueidade",
    "unit": "diária",
    "price": 5000,
    "supplier": "-",
    "context": "EX_AE"
  },
  {
    "category": "Outros",
    "item": "Teste de estanqueidade",
    "unit": "diária",
    "price": 5000,
    "supplier": "-",
    "context": "Pressurização"
  },
  {
    "category": "Outros",
    "item": "TORRE - 6\"",
    "unit": "Unid",
    "price": 61260.024,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Tubulação - 1 1/2\"",
    "unit": "m",
    "price": 124.3543,
    "supplier": "SIDERAÇO RJ",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Tubulação - 1 1/4\"",
    "unit": "m",
    "price": 110.0232,
    "supplier": "SIDERAÇO RJ",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Tubulação - 1\"",
    "unit": "m",
    "price": 85.3361,
    "supplier": "SIDERAÇO RJ",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Tubulação - 2 1/2\"",
    "unit": "m",
    "price": 222.48,
    "supplier": "SIDERAÇO RJ",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Tubulação - 2\"",
    "unit": "m",
    "price": 150.72,
    "supplier": "SIDERAÇO RJ",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Tubulação - 3\"",
    "unit": "m",
    "price": 286.76,
    "supplier": "SIDERAÇO RJ",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Tubulação - 3/4\"",
    "unit": "m",
    "price": 86.0589,
    "supplier": "SIDERAÇO RJ",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Tubulação - 4\"",
    "unit": "m",
    "price": 395.81,
    "supplier": "SIDERAÇO RJ",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Tubulação - 5\"",
    "unit": "m",
    "price": 554.72,
    "supplier": "SIDERAÇO RJ",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Tubulação - 6\"",
    "unit": "m",
    "price": 691.89,
    "supplier": "SIDERAÇO RJ",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "UNIÃO, GALVANIZADO, 150 LBS, ROSCA BSP, 1 1/2\"",
    "unit": "-",
    "price": 232.8,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "UNIÃO, GALVANIZADO, 150 LBS, ROSCA BSP, 1 1/4\"",
    "unit": "-",
    "price": 200.4,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "UNIÃO, GALVANIZADO, 150 LBS, ROSCA BSP, 2 1/2\"",
    "unit": "-",
    "price": 487.2,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "UNIÃO, GALVANIZADO, 150 LBS, ROSCA BSP, 2\"",
    "unit": "-",
    "price": 321.6,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "UNIÃO, GALVANIZADO, 150 LBS, ROSCA BSP, 3\"",
    "unit": "-",
    "price": 712.8,
    "supplier": "Valflor 06-01-2026",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Verba de Manutenção de limpeza na linha (141B, Solda Phoscoper, Nitrogênio, Oxigênio,etc)",
    "unit": "Nº SISTEMA",
    "price": 850,
    "supplier": "29-12-25",
    "context": "AC - DIRETA - COBRE"
  },
  {
    "category": "Outros",
    "item": "Véu de Poliéster",
    "unit": "Rolo",
    "price": 240,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Outros",
    "item": "Water flow Switch",
    "unit": "unid",
    "price": 500,
    "supplier": "-",
    "context": "AC - INDIRETA - AGUA"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 1 1/2\"",
    "unit": "m",
    "price": 124.3543,
    "supplier": "-",
    "context": "Água Gelada - Galvanizado"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 1 1/2\"",
    "unit": "m",
    "price": 36.4767,
    "supplier": "-",
    "context": "Água Gelada - PVCU SCHD 8"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 1 1/4\"",
    "unit": "m",
    "price": 110.0232,
    "supplier": "-",
    "context": "Água Gelada - Galvanizado"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 1 1/4\"",
    "unit": "m",
    "price": 27.2667,
    "supplier": "-",
    "context": "Água Gelada - PVCU SCHD 8"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 1\"",
    "unit": "m",
    "price": 85.3361,
    "supplier": "-",
    "context": "Água Gelada - Galvanizado"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 1\"",
    "unit": "m",
    "price": 19.8417,
    "supplier": "-",
    "context": "Água Gelada - PVCU SCHD 8"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 2 1/2\"",
    "unit": "m",
    "price": 222.48,
    "supplier": "-",
    "context": "Água Gelada - Galvanizado"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 2 1/2\"",
    "unit": "m",
    "price": 68.0017,
    "supplier": "-",
    "context": "Água Gelada - PVCU SCHD 8"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 2\"",
    "unit": "m",
    "price": 150.72,
    "supplier": "-",
    "context": "Água Gelada - Galvanizado"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 2\"",
    "unit": "m",
    "price": 38.2767,
    "supplier": "-",
    "context": "Água Gelada - PVCU SCHD 8"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 3\"",
    "unit": "m",
    "price": 286.76,
    "supplier": "-",
    "context": "Água Gelada - Galvanizado"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 3\"",
    "unit": "m",
    "price": 102.465,
    "supplier": "-",
    "context": "Água Gelada - PVCU SCHD 8"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 3/4\"",
    "unit": "m",
    "price": 86.0589,
    "supplier": "-",
    "context": "Água Gelada - Galvanizado"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 3/4\"",
    "unit": "m",
    "price": 16.7417,
    "supplier": "-",
    "context": "Água Gelada - PVCU SCHD 8"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 4\"",
    "unit": "m",
    "price": 395.81,
    "supplier": "-",
    "context": "Água Gelada - Galvanizado"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 4\"",
    "unit": "m",
    "price": 140.2467,
    "supplier": "-",
    "context": "Água Gelada - PVCU SCHD 8"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 5\"",
    "unit": "m",
    "price": 554.72,
    "supplier": "-",
    "context": "Água Gelada - Galvanizado"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 5\"",
    "unit": "m",
    "price": 313.055,
    "supplier": "-",
    "context": "Água Gelada - PVCU SCHD 8"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 6\"",
    "unit": "m",
    "price": 691.89,
    "supplier": "-",
    "context": "Água Gelada - Galvanizado"
  },
  {
    "category": "Rede hidráulica",
    "item": "Tubulação - 6\"",
    "unit": "m",
    "price": 313.055,
    "supplier": "-",
    "context": "Água Gelada - PVCU SCHD 8"
  }
];

/**
 * Normaliza strings para busca técnica comparativa
 */
function normalizeTechString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\"']/g, '')
    .replace(/\b(\d+)[.\-](\d+\/\d+)\b/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai bitolas exatas (ex: 1 3/8, 1 1/2, 3/8, 5/8, 3/4, 1/4, 1/2, 2 1/2)
 */
function extractExactGauges(text) {
  const normalized = normalizeTechString(text);
  // Identifica números inteiros compostos com fração ex: '1 3/8', '2 1/2' ou frações simples '3/8', '5/8'
  const compositeMatches = normalized.match(/\b\d+\s+[\d]+\/[\d]+\b/g) || [];
  let remaining = normalized;
  for (const cm of compositeMatches) {
    remaining = remaining.replace(cm, ' ');
  }
  const simpleFractionMatches = remaining.match(/\b\d+\/\d+\b/g) || [];
  const mmMatches = remaining.match(/\b\d+(?:[.,]\d+)?\s*mm\b/g) || [];
  const cvMatches = remaining.match(/\b\d+(?:[.,]\d+)?\s*cv\b/g) || [];

  return [
    ...compositeMatches.map(m => m.trim()),
    ...simpleFractionMatches.map(m => m.trim()),
    ...mmMatches.map(m => m.replace(/\s+/g, '')),
    ...cvMatches.map(m => m.replace(/\s+/g, ''))
  ];
}

const MATERIAL_KEYWORDS = [
  'cobre', 'chapa', 'galvaniz', 'aluminio', 'armaflex', 'elastomer',
  'espuma', 'polietileno', 'pvc', 'mpu', 'isodec', 'flexivel', 'rigido',
  'valvula', 'duto', 'cabo', 'disjuntor', 'quadro', 'motor', 'exaustor',
  'alimentacao', 'hospedagem', 'transporte', 'supervisor', 'art', 'databook',
  'silicone', 'fita', 'limpeza'
];

export function isNonMaterial(it) {
  if (!it) return true;
  if (it.category === 'Administrativo / logística') return true;
  if (it.category === 'Mão de obra') return true;

  const itemLower = (it.item || '').toLowerCase();
  const unitLower = (it.unit || '').toLowerCase();

  if (/(gasolina|alimentação|hospedagem|passagem|salário|diária|supervisor|engenheiro|art|as built|databook|gem|manual)/i.test(itemLower)) return true;
  if (/(limpeza de duto|pintura dos duto|remanejamento|teste de estanqueidade|interligações elétricas|verba de manutenção)/i.test(itemLower)) return true;
  if (itemLower === 'tab' || itemLower === 'remanejamento') return true;
  if (/(andaime|carro \(strada\)|içamento|plataforma elevatória|picagem\/trepanação)/i.test(itemLower)) return true;
  if (/(horario comercial|horario extra|residencial alto padrão)/i.test(itemLower)) return true;
  if (/(capacidade total das evaporadoras|infra \(distância)/i.test(itemLower)) return true;
  if (unitLower === 'mês' || unitLower === 'diária' || unitLower === 'hora' || unitLower === 'h') return true;

  return false;
}

/**
 * Consulta a Base Econômica Oficial Sabrar para precificação e correspondência técnica.
 * Implementa integralmente as 5 regras da "BASE ECONÔMICA SABRar — COMPLEMENTO DO AGENTE".
 *
 * @param {string} itemName Nome do material ou serviço identificado pelo agente
 * @param {Object} options Critérios técnicos adicionais
 * @param {string} [options.context] Contexto do sistema (ex: 'AC - DIRETA - COBRE', 'EX_AE')
 * @param {string} [options.unit] Unidade de medida esperada (ex: 'm', 'm²', 'unid', 'kg', 'mês')
 * @param {string} [options.spec] Especificação complementar (bitola, espessura, potência)
 * @returns {Object} Resultado da busca com preço, unidade, contexto e status
 */
export function findSabrarEconomicPrice(itemName, options = {}) {
  const { context = '', unit = '', spec = '' } = options;
  const searchNorm = normalizeTechString(`${itemName} ${spec}`);
  const unitNorm = normalizeTechString(unit);
  const contextNorm = normalizeTechString(context);

  const queryGauges = extractExactGauges(searchNorm);
  const STRICT_MATERIALS = ['armaflex', 'cobre', 'mpu', 'chapa', 'pvc', 'tubo', 'silicone', 'sikaflex', 'fita', 'disjuntor', 'damper', 'difusor', 'grelha', 'exaustor'];
  const queryStrictMat = STRICT_MATERIALS.filter(m => searchNorm.includes(m));
  const STOP_WORDS = new Set(['para', 'com', 'por', 'linha', 'tipo', 'obra', 'das', 'dos', 'uma', 'seu', 'sua']);
  const searchWords = searchNorm.split(' ').filter(w => w.length > 2 && !STOP_WORDS.has(w));

  // Filtra candidatos técnicos
  const candidates = [];

  for (const entry of SABRAR_ECONOMIC_BASE_ITEMS) {
    // Rejeita custos administrativos, logística e serviços não materiais (Diretriz SABRAR)
    if (isNonMaterial(entry)) continue;

    // Regra 4: Preço zero não é preço válido
    if (!entry.price || entry.price <= 0) continue;

    const entryNorm = normalizeTechString(entry.item);
    const categoryNorm = normalizeTechString(entry.category);
    const fullEntryNorm = `${categoryNorm} ${entryNorm}`;

    // Regra 2: Rejeição por discrepância técnica de material
    if (queryStrictMat.length > 0) {
      if (queryStrictMat.includes('armaflex') && !fullEntryNorm.includes('armaflex')) continue;
      if (queryStrictMat.includes('cobre') && !fullEntryNorm.includes('cobre') && !categoryNorm.includes('frigor')) continue;
      if (queryStrictMat.includes('mpu') && !fullEntryNorm.includes('mpu')) continue;
      if (queryStrictMat.includes('pvc') && !fullEntryNorm.includes('pvc')) continue;
      if (queryStrictMat.includes('tubo') && !fullEntryNorm.includes('tubo') && !fullEntryNorm.includes('tubulacao') && !categoryNorm.includes('frigor') && !categoryNorm.includes('hidraulica')) continue;
      if (queryStrictMat.includes('chapa') && !fullEntryNorm.includes('chapa')) continue;
      if (queryStrictMat.includes('silicone') && !fullEntryNorm.includes('silicone') && !fullEntryNorm.includes('sikaflex')) continue;
    }

    // Regra 2: Rejeição estrita por discrepância técnica de bitola (ex: 3/8 != 1 3/8)
    const entryGauges = extractExactGauges(entryNorm);
    let gaugeMismatch = false;

    if (queryGauges.length > 0) {
      for (const qg of queryGauges) {
        // Se a query pede fração simples (ex: '3/4'), rejeita itens compostos (ex: '1 3/4')
        if (!qg.includes(' ') && qg.includes('/')) {
          const hasCompositeInEntry = entryGauges.some(eg => eg.endsWith(qg) && eg !== qg);
          const hasExact = entryGauges.includes(qg);
          if (hasCompositeInEntry && !hasExact) {
            gaugeMismatch = true;
            break;
          }
        }
        if (entryGauges.length > 0 && !entryGauges.includes(qg)) {
          // Se o item do banco tem bitola definida e não contém a bitola procurada, rejeita
          gaugeMismatch = true;
          break;
        }
      }
    }
    if (gaugeMismatch) continue;

    // Regra 1: Deve haver correspondência técnica de palavras na descrição
    let wordScore = 0;
    for (const w of searchWords) {
      if (entryNorm.includes(w)) wordScore += 25;
      else if (categoryNorm.includes(w)) wordScore += 10;
    }

    // Se nenhuma palavra chave relevante coincidir, REJEITA imediatamente
    if (wordScore < 25) {
      continue;
    }

    let score = wordScore;

    // Correspondência de unidade
    if (unitNorm && normalizeTechString(entry.unit) === unitNorm) {
      score += 25;
    }

    // Regra 3: Priorização de contexto compatível com a obra como critério de desempate
    if (contextNorm && normalizeTechString(entry.context).includes(contextNorm)) {
      score += 40;
    } else if (contextNorm && (
      (contextNorm.includes('cobre') && entry.context.includes('COBRE')) ||
      (contextNorm.includes('agua') && entry.context.includes('AGUA')) ||
      (contextNorm.includes('cozinha') && entry.context.includes('Cozinha')) ||
      (contextNorm.includes('pressuriz') && entry.context.includes('Pressur'))
    )) {
      score += 20;
    }

    candidates.push({ entry, score });
  }

  // Ordena por maior pontuação (contexto + fidelidade técnica)
  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0) {
    const best = candidates[0].entry;
    let finalPrice = best.price;
    let finalUnit = best.unit;

    // Conversão de Caixa de MPU (24m² por caixa) se a unidade requisitada for m²
    if ((unitNorm === 'm2' || unitNorm === 'm²') && best.item.toLowerCase().includes('mpu') && (best.item.includes('2,4M2') || best.item.includes('2,4m2') || best.item.includes('2.4m2'))) {
      finalPrice = Number((best.price / 24).toFixed(2));
      finalUnit = 'm²';
    }

    return {
      matched: true,
      priceStatus: 'OFICIAL_BASE_SABRAR',
      price: finalPrice,
      unit: finalUnit,
      matchedItem: best.item,
      category: best.category,
      context: best.context,
      supplier: best.supplier
    };
  }

  // Regra 4: Sem correspondência técnica válida
  return {
    matched: false,
    priceStatus: 'PREÇO_NAO_LOCALIZADO',
    price: null,
    unit: unit || 'un',
    matchedItem: null,
    category: null,
    context: null,
    supplier: null
  };
}
