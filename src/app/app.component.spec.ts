import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('debe instanciarse correctamente el componente raíz', () => {
    const app = new AppComponent();
    expect(app).toBeTruthy();
  });
});
