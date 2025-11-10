require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const PORTA_PROXY = 3000; 
const URL_SERVIDOR_NUVEM = process.env.URL_NUVEM;
const app = express();

app.use(cors()); 
app.use(express.json()); 
app.post('/proxy', async (req, res) => {
    
    // 1. Receber e logar os dados da BitDog
    const dadosRecebidos = req.body;
    console.log(`[PROXY] Dados recebidos da BitDog (${dadosRecebidos.codigoPlaca || 'ID Desconhecido'}):`);
    console.log(dadosRecebidos);

    // 2. Encaminhar os dados para a Nuvem
    try {
        console.log(`[PROXY] Encaminhando para a nuvem em: ${URL_SERVIDOR_NUVEM}`);

        // Fazer a requisição POST para o servidor na nuvem usando Axios
        const respostaDaNuvem = await axios.post(URL_SERVIDOR_NUVEM, dadosRecebidos, {
            headers: {
                // 'Authorization': 'Bearer sua_chave_secreta_aqui'
                'Content-Type': 'application/json'
            }
        });

        console.log(`[PROXY] Sucesso! Resposta da nuvem: ${respostaDaNuvem.status}`);

        
        res.status(200).send({ message: 'Dados encaminhados com sucesso!' });

    } catch (error) {
        console.error(`[PROXY] ERRO ao encaminhar para a nuvem: ${error.message}`);
        
        res.status(500).send({ message: 'Erro no proxy ao encaminhar dados.' });
    }
});

app.listen(PORTA_PROXY, () => {
    console.log(`[PROXY] Servidor proxy rodando na porta ${PORTA_PROXY}`);
    console.log(`Aguardando dados das BitDogs...`);
});