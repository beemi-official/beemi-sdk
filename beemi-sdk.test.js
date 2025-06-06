import { on, emit } from './beemi-sdk-0.1.js';

test('bus', done => {
  on('chat', m => { 
    expect(m.text).toBe('hi'); 
    done(); 
  });
  emit('chat', {text:'hi'});
}); 