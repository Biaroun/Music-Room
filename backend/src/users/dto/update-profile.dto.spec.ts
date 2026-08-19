import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateProfileDto } from './update-profile.dto';

describe('UpdateProfileDto avatar validation', () => {
  it('accepts a known avatar id', async () => {
    const dto = plainToInstance(UpdateProfileDto, { avatar: 'avatar-3' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty string (no avatar selected)', async () => {
    const dto = plainToInstance(UpdateProfileDto, { avatar: '' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a missing avatar field', async () => {
    const dto = plainToInstance(UpdateProfileDto, { bio: 'hello' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown avatar id', async () => {
    const dto = plainToInstance(UpdateProfileDto, { avatar: 'avatar-99' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('avatar');
  });
});
