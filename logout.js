import { logoutInstance, deleteInstance } from './lib/evolution.js';
import dotenv from 'dotenv';
dotenv.config();

const instances = ['penny', 'penny_test', 'OfficialMeta'];
const apiUrl = process.env.EVOLUTION_API_URL || 'http://localhost:8080';

async function run() {
  console.log(`\n🔌 Conectando ao Evolution API em: ${apiUrl}`);
  console.log('Tentando desconectar instâncias para troca de número...');
  
  for (const instance of instances) {
    try {
      console.log(`\n🔄 Tentando logout de: ${instance}...`);
      await logoutInstance(instance, apiUrl, process.env.EVOLUTION_API_KEY);
      console.log(`✅ SUCESSO: ${instance} desconectado! Agora você pode ler um novo QR Code.`);
    } catch (e) {
      console.log(`⚠️ Falha no logout padrão de '${instance}': ${e.message}`);
      
      // Se falhar o logout, tenta deletar a instância para forçar recriação
      try {
             console.log(`🗑️ Tentando deletar (forçar limpeza) de: ${instance}...`);
             await deleteInstance(instance, apiUrl, process.env.EVOLUTION_API_KEY);
             console.log(`✅ SUCESSO: ${instance} deletado/limpo!`);
      } catch (err) {
             console.log(`❌ Não foi possível limpar '${instance}'.`);
      }
    }
  }
}

run();
