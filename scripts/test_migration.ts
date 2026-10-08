import { StateManager } from '../src/services/state.manager';

async function testMigration() {
  try {
    const manager = new StateManager();
    await manager.load();
    console.log('✅ StateManager.load() completed successfully.');
    
    // Try to call a method that uses the column
    await manager.getLastNotificationTime('test-user');
    console.log('✅ getLastNotificationTime() called successfully.');
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testMigration().catch(console.error);
