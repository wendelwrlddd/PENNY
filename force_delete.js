import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.EVOLUTION_API_URL || 'https://penny-evolution-api.fly.dev';
const API_KEY = process.env.EVOLUTION_API_KEY || 'n9i8skxugfzy3w97vftz';

async function forceDeleteInstance(instanceName) {
  console.log(`🗑️ Attempting to force delete instance: ${instanceName}`);
  
  try {
    // Try normal delete first
    const response = await axios.delete(`${API_URL}/instance/delete/${instanceName}`, {
      headers: { 'apikey': API_KEY }
    });
    console.log('✅ Instance deleted successfully:', response.data);
  } catch (error) {
    console.log('⚠️ Normal delete failed, trying logout first...');
    
    try {
      // Try logout first
      await axios.post(`${API_URL}/instance/logout/${instanceName}`, {}, {
        headers: { 'apikey': API_KEY }
      });
      console.log('✅ Logged out, now trying delete again...');
      
      // Try delete again
      const response = await axios.delete(`${API_URL}/instance/delete/${instanceName}`, {
        headers: { 'apikey': API_KEY }
      });
      console.log('✅ Instance deleted successfully:', response.data);
    } catch (finalError) {
      console.error('❌ Could not delete instance:', finalError.response?.data || finalError.message);
      console.log('\n📌 Manual solution:');
      console.log('1. Access the Evolution API server directly');
      console.log('2. Delete the instance folder manually');
      console.log('3. Or use a different instance name (e.g., "penny_final")');
    }
  }
}

// Run
forceDeleteInstance('penny').then(() => {
  console.log('\n✅ Done! You can now create a new instance with the name "penny"');
});
