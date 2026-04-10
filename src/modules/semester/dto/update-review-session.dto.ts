import { PartialType } from '@nestjs/swagger';
import { CreateReviewSessionDto } from './create-review-session.dto';

export class UpdateReviewSessionDto extends PartialType(CreateReviewSessionDto) {}
