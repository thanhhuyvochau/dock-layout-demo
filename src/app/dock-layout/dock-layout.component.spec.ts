import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DockLayoutComponent } from './dock-layout.component';

describe('DockLayoutComponent', () => {
  let component: DockLayoutComponent;
  let fixture: ComponentFixture<DockLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DockLayoutComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DockLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
