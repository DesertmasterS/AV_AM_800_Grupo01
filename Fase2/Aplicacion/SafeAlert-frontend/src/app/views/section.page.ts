import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';

@Component({
  selector: 'app-section', standalone: true,
  imports: [IonicModule, RouterLink],
  templateUrl: './section.page.html', styleUrls: ['./section.page.scss'],
})
export class SectionPage {
  readonly page = inject(ActivatedRoute).snapshot.data as {
    title: string; eyebrow: string; description: string; icon: string;
    areas: { title: string; icon: string }[];
  };
}
