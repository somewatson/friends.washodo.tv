import { StreamerStateRepository } from '../src/streamerStateRepository';

async function testRepoMigration() {
  try {
    const repo = new StreamerStateRepository();
    await repo.init();
    console.log('✅ StreamerStateRepository.init() successful');
    
    // Test methods that use the new columns
    await repo.getLastThumbnailUrl('testuser');
    console.log('✅ getLastThumbnailUrl() successful');
    
    await repo.getProfileImageUrl('testuser');
    console.log('✅ getProfileImageUrl() successful');
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testRepoMigration().catch(console.error);
