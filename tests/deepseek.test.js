const DeepSeekProvider = require('../src/llm/providers/DeepSeekProvider');

describe('DeepSeek Provider Module', () => {
  test('DeepSeekProvider instantiates and exposes contract methods', () => {
    const provider = new DeepSeekProvider();
    expect(typeof provider.generateThesis).toBe('function');
    expect(typeof provider.isAvailable).toBe('function');
    expect(provider.model).toBeDefined();
    expect(provider.baseUrl).toContain('deepseek');
  });
});
