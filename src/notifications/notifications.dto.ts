import { IsIn } from 'class-validator';

export class LanguageDto {
  @IsIn(['en', 'sw'])
  language: 'en' | 'sw';
}
