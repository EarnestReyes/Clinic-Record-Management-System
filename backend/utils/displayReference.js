import Counter from '../models/Counter.js';
import Setting from '../models/Setting.js';
import { ApiError } from '../middleware/errors.js';

export const departmentCodes = Object.freeze({
    orthopedist: 'OR',
    pediatrician: 'PD',
    'ob-gyn': 'OB',
    dermatologist: 'DM',
    cardiologist: 'CD',
    neurologist: 'NR',
    'general-practitioner': 'GP',
    'general-nurse': 'GN'
});

const allDepartmentCodes = [...Object.values(departmentCodes), 'AD'];

export function departmentFor(specialty, role) {
    const code = departmentCodes[specialty];

    if (code) return code;

    if (role === 'Administrator' && !specialty) {
        return 'AD';
    }

    throw new ApiError(
        400,
        'The verified profession has no configured department code. Choose a supported profession.'
    );
}

export function serviceSeries(foundingYear, now = new Date()) {
    const year = Number(
        new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            year: 'numeric'
        }).format(now)
    );

    if (!Number.isInteger(foundingYear) ||
        foundingYear < 1800 ||
        foundingYear > year
    ) {
        throw new ApiError(
            409,
            'An administrator must configure the clinic founding year in Clinic Information before creating department references.'
        );
    }

    return String(year - foundingYear + 1).padStart(2, '0');
}

export async function nextDisplayReference(kind, specialty, role) {
    if (!['MR', 'APT', 'U'].includes(kind)) {
        throw new ApiError(400, 'Unsupported reference type.');
    }

    const department = departmentFor(specialty, role);

    if (kind !== 'U' && ['AD', 'GN'].includes(department)) {
        throw new ApiError(
            400,
            'A verified attending physician department is required.'
        );
    }

    const series =
        kind === 'U' ?
        '' :
        serviceSeries(
            (await Setting.findById('clinic')) ?.foundingYear ??
            new Setting().foundingYear
        );

    const key = `display-reference:${kind}:${department}${
    series ? `:${series}` : ''
  }`;

  let counter;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      counter = await Counter.findOneAndUpdate(
        { _id: key },
        { $inc: { value: 1 } },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );
      break;
    } catch (error) {
      if (error.code !== 11000 || attempt === 2) {
        throw error;
      }
    }
  }

  if (
    !Number.isSafeInteger(counter?.value) ||
    counter.value < 1
  ) {
    throw new ApiError(
      409,
      'The display reference counter needs administrator review.'
    );
  }

  const sequence = String(counter.value).padStart(6, '0');

 if (kind === 'U') {
  return `U${department}-${sequence}`;
}

if (kind === 'MR') {
  return `MR${department}-${series}-${sequence}`;
}

return `APT-${series}-${sequence}-${department}`;
}

export const displayReferenceField = kind => ({
  type: String,
  immutable: true,
  validate: {
    validator(value) {
      if (value == null) return true;

      if (kind === 'U') {
        const match = value.match(/^U([A-Z]{2})-(\d{6,})$/);

        return Boolean(
          match &&
          allDepartmentCodes.includes(match[1])
        );
      }

      if (kind === 'MR') {
        const match = value.match(
         /^MR([A-Z]{2})-(\d{2,})-(\d{6,})$/
        );

        return Boolean(
          match &&
          Object.values(departmentCodes).includes(match[1])
        );
      }

      if (kind === 'APT') {
        const match = value.match(
          /^APT-(\d{2,})-(\d{6,})-([A-Z]{2})$/
        );

        return Boolean(
          match &&
          Object.values(departmentCodes).includes(match[3])
        );
      }

      return false;
    },
    message: 'Invalid display reference.'
  }
});

export const displayReferenceIndex = {
  unique: true,
  partialFilterExpression: {
    displayReference: { $type: 'string' }
  }
};