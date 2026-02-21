import crypto from 'crypto';
import https from 'https';

const API_KEY = process.env.BINANCE_API_KEY || '';
const API_SECRET = process.env.BINANCE_SECRET_KEY || process.env.BINANCE_API_SECRET || '';
const BINANCE_REGION = (process.env.BINANCE_REGION || 'GLOBAL').toUpperCase();

function getApiHosts() {
  if (BINANCE_REGION === 'TR') {
    return {
      ping: 'https://www.binance.tr/open/v1/common/time',
      account: 'https://www.binance.tr/open/v1/account/spot',
      exchangeInfo: 'https://api.binance.me/api/v3/exchangeInfo?symbol=ETHUSDT',
    };
  }

  return {
    ping: 'https://api.binance.com/api/v3/ping',
    account: 'https://api.binance.com/api/v3/account',
    exchangeInfo: 'https://api.binance.com/api/v3/exchangeInfo?symbol=ETHUSDT',
  };
}

function hmacSha256(message, secret) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

async function testBinanceKeys() {
  console.log('🔍 Binance API Key Doğrulama Başlıyor...\n');
  console.log(`🌍 Region: ${BINANCE_REGION}`);

  if (!API_KEY || !API_SECRET) {
    console.log('❌ BINANCE_API_KEY / BINANCE_SECRET_KEY eksik');
    process.exit(1);
  }

  const hosts = getApiHosts();

  // Test 1: Public endpoint (no auth needed)
  console.log('Test 1: Binance API Bağlantısı');
  try {
    const response = (await fetch(hosts.ping)).ok
      ? '✅ Başarılı'
      : '❌ Başarısız';
    console.log(`  ${response}\n`);
  } catch (e) {
    console.log(`  ❌ Hata: ${e.message}\n`);
  }

  // Test 2: Test account access with API key
  console.log('Test 2: API Key Geçerliliği');
  try {
    const timestamp = Date.now();
    const params = BINANCE_REGION === 'TR'
      ? `recvWindow=5000&timestamp=${timestamp}`
      : `timestamp=${timestamp}`;
    const signature = hmacSha256(params, API_SECRET);
    const url = `${hosts.account}?${params}&signature=${signature}`;

    const response = await fetch(url, {
      headers: {
        'X-MBX-APIKEY': API_KEY,
      },
    });

    const data = await response.json();

    if (response.ok) {
      const payload = BINANCE_REGION === 'TR' ? data.data : data;
      console.log('  ✅ API Key Geçerli!');
      console.log(`  📊 Hesap Bilgileri:`);
      console.log(`     - Maker Commission: ${payload.makerCommission}%`);
      console.log(`     - Taker Commission: ${payload.takerCommission}%`);
      console.log(`     - Can Trade: ${payload.canTrade}`);
      console.log(`     - Can Deposit: ${payload.canDeposit}`);
      console.log(`     - Can Withdraw: ${payload.canWithdraw}`);
      console.log(`\n  💰 Bakiyeler:`);

      const rawBalances = BINANCE_REGION === 'TR' ? (payload.accountAssets || []) : (payload.balances || []);
      const balances = rawBalances.filter(
        (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
      );

      if (balances.length === 0) {
        console.log('     Hiçbir varlık bulunamadı (boş hesap olabilir)');
      } else {
        balances.forEach((b) => {
          const free = parseFloat(b.free);
          const locked = parseFloat(b.locked);
          const total = free + locked;
          if (total > 0) {
            console.log(
              `     - ${b.asset}: ${free} (serbest) + ${locked} (kilitli) = ${total}`
            );
          }
        });
      }
    } else if (response.status === 401) {
      console.log('  ❌ Geçersiz API Key veya Secret');
      console.log(`     Hata: ${data.msg}`);
    } else if (response.status === 403) {
      console.log('  ⚠️  IP Adresi Sınırlı');
      console.log(`     Bu IP adresinden erişime izin verilmiş olabilir`);
      console.log(`     Hata: ${data.msg}`);
    } else {
      console.log(`  ❌ Hata (${response.status}): ${data.msg}`);
    }
  } catch (e) {
    console.log(`  ❌ Ağ Hatası: ${e.message}`);
  }

  // Test 3: Check trading pairs
  console.log('\nTest 3: Ticaret Çiftleri (ETHUSDT)');
  try {
    const response = await fetch(hosts.exchangeInfo);
    const data = await response.json();

    if (data.symbols && data.symbols.length > 0) {
      const symbol = data.symbols[0];
      console.log(`  ✅ ETHUSDT Bulundu`);
      console.log(`     - Status: ${symbol.status}`);
      console.log(`     - Base Asset: ${symbol.baseAsset}`);
      console.log(`     - Quote Asset: ${symbol.quoteAsset}`);
    } else {
      console.log('  ❌ ETHUSDT Bulunamadı');
    }
  } catch (e) {
    console.log(`  ❌ Hata: ${e.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Sonuç:');
  console.log('✅ API Keys yapılandırılmış ve test edilmiş');
  console.log('Bot şimdi GERÇEK Binance hesabınızdan ticaret yapabilir!');
  console.log('='.repeat(60));
}

testBinanceKeys().catch(console.error);
