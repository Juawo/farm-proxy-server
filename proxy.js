// Importar as bibliotecas
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();


const PORTA_PROXY = 3000;
const URL_SERVIDOR_NUVEM = process.env.URL_NUVEM; 
const API_URL_silos= process.env.API_URL_silos;

const IDS_DAS_PLACAS = new Set([
    "placa_jp", // ID da placa 1
    // "placa_kd",  // ID da placa 2
    // "placa_jv"   // ID da placa 3
]);

// O "estado" (memória) do proxy.
let dataStore = new Map();

const app = express();
app.use(cors());
app.use(express.json()); 
/**
 * Função chamada quando TEMOS os dados de todas as placas.
 * Ela calcula a média e envia para a nuvem.
 */
async function enviarMediaParaNuvem() {

    // 1. Pega todos os valores (dados) que armazenamos
    const todasLeituras = Array.from(dataStore.values());

    // 2. Calcula as médias
    const totalTemp = todasLeituras.reduce((soma, leitura) => soma + leitura.temperatura, 0);
    const totalHum = todasLeituras.reduce((soma, leitura) => soma + leitura.umidade, 0);
    const numPlacas = todasLeituras.length;

    const dadosDeMedia = {
        metrics_id : 1, // "Rótulo" ID do galpão que está enviando a média
        temperature: totalTemp / numPlacas,
        humidity: totalHum / numPlacas,
    };

    console.log('[PROXY] Set completo! Calculando média:', dadosDeMedia);

    // 3. Envia para a nuvem
    try {
        console.log(`[PROXY] Enviando média para a nuvem em: ${process.env.URL_NUVEM}`);
        
        await axios.post(process.env.URL_NUVEM, dadosDeMedia, {
            headers: {
                'Content-Type': 'application/json'
                // 'Authorization': 'Bearer sua_chave_secreta_aqui' // Se precisar
            }
        });

        console.log('[PROXY] Média enviada com sucesso para a nuvem!');

    } catch (error) {
        console.error(`[PROXY] ERRO ao enviar média para a nuvem: ${error.message}`);
    }
}

/**
 * Rota Principal do Proxy
 * As BitDogs (Picos W) enviam os dados para cá.
 */
app.post('/dados', async (req, res) => {
    
    // 1. Pega os dados do corpo da requisição
    const { codigoPlaca, temperatura, umidade } = req.body;

    // 2. Validação básica
    if (!codigoPlaca || temperatura == null || umidade == null) {
        console.warn('[PROXY] Recebido payload inválido:', req.body);
        return res.status(400).send({ message: 'Payload inválido (precisa de codigoPlaca, temperatura, umidade).' });
    }

    // 3. Ignora se for uma placa que não esperamos
    if (!IDS_DAS_PLACAS.has(codigoPlaca)) {
        console.warn(`[PROXY] Recebido dado de placa desconhecida: ${codigoPlaca}`);
        return res.status(400).send({ message: 'Placa desconhecida.' });
    }

    // 4. Armazena o dado (substituindo o valor antigo se já existir)
    dataStore.set(codigoPlaca, { temperatura, umidade });
    console.log(`[PROXY] Dado recebido de ${codigoPlaca}. Progresso: ${dataStore.size}/${IDS_DAS_PLACAS.size}`);

    // 5. RESPONDE PARA A BITDOG IMEDIATAMENTE!
    res.status(200).send({ message: 'Dados recebidos pelo proxy.' });

    // 6. Verifica se o "dataStore" agora tem todos os dados
    if (dataStore.size === IDS_DAS_PLACAS.size) {
        // TEMOS OS DADOS DAS 3 PLACAS!
        
        // Chama a função para calcular e enviar a média
        await enviarMediaParaNuvem();
        
        // 7. Limpa o "dataStore" para começar o próximo ciclo de coleta
        console.log('[PROXY] Limpando store. Aguardando próximo set de dados das placas.');
        dataStore.clear();
    }
});
    
// rota do silo
    app.post('/silo/reading', async (req, res) => {
  console.log('---------------------------------');
  console.log('DADOS RECEBIDOS DA PLACA PICO (silos):');
  console.log(req.body);
  console.log('---------------------------------');

  try {
    const { silo_id, level_value } = req.body;

    
    const dadosParaAPI = {
      silo_id,
      level_value
    };

    console.log(`Encaminhando dados para: ${API_URL}...`);
    const response = await axios.post(API_URL, dadosParaAPI, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`API do Render respondeu com status: ${response.status}`);
    console.log('Dados encaminhados com sucesso!\n');
    
    res.status(200).json({ 
      status: 'sucesso', 
      mensagem: 'Dados recebidos e encaminhados pelo proxy.',
      dados: dadosParaAPI 
    });

  } catch (error) {
    console.error('ERRO AO ENCAMINHAR DADOS PARA A API ONLINE:');
    if (error.response) {
      console.error(`> Status: ${error.response.status}`);
      console.error(`> Resposta da API:`, error.response.data);
    } else if (error.request) {
      console.error('> Nenhuma resposta recebida da API online. Verifique a URL e a conexão.');
    } else {
      console.error('> Erro na configuração do Axios:', error.message);
    }
    console.error('---------------------------------\n');
    
    res.status(500).send('Erro do proxy ao tentar encaminhar os dados.');
  }
});
// Iniciar o servidor proxy
app.listen(PORTA_PROXY, () => {
    console.log(`[PROXY] Servidor proxy de MÉDIA rodando na porta ${PORTA_PROXY}`);
    console.log(`Aguardando dados das placas: ${Array.from(IDS_DAS_PLACAS).join(', ')}`);
});