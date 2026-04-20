import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultUnits = [
    // Weight
    { name: 'Kilogram', abbreviation: 'kg', category: 'Weight', isDefault: true },
    { name: 'Gram', abbreviation: 'g', category: 'Weight', isDefault: false },
    { name: 'Ton', abbreviation: 't', category: 'Weight', isDefault: false },
    { name: 'Pound', abbreviation: 'lb', category: 'Weight', isDefault: false },

    // Length
    { name: 'Meter', abbreviation: 'm', category: 'Length', isDefault: true },
    { name: 'Centimeter', abbreviation: 'cm', category: 'Length', isDefault: false },
    { name: 'Millimeter', abbreviation: 'mm', category: 'Length', isDefault: false },
    { name: 'Kilometer', abbreviation: 'km', category: 'Length', isDefault: false },
    { name: 'Foot', abbreviation: 'ft', category: 'Length', isDefault: false },
    { name: 'Inch', abbreviation: 'in', category: 'Length', isDefault: false },

    // Volume
    { name: 'Liter', abbreviation: 'L', category: 'Volume', isDefault: true },
    { name: 'Milliliter', abbreviation: 'mL', category: 'Volume', isDefault: false },
    { name: 'Cubic Meter', abbreviation: 'm³', category: 'Volume', isDefault: false },
    { name: 'Gallon', abbreviation: 'gal', category: 'Volume', isDefault: false },

    // Area
    { name: 'Square Meter', abbreviation: 'm²', category: 'Area', isDefault: true },
    { name: 'Square Foot', abbreviation: 'ft²', category: 'Area', isDefault: false },
    { name: 'Acre', abbreviation: 'ac', category: 'Area', isDefault: false },

    // Quantity
    { name: 'Piece', abbreviation: 'pcs', category: 'Quantity', isDefault: true },
    { name: 'Dozen', abbreviation: 'doz', category: 'Quantity', isDefault: false },
    { name: 'Box', abbreviation: 'box', category: 'Quantity', isDefault: false },
    { name: 'Bag', abbreviation: 'bag', category: 'Quantity', isDefault: false },
    { name: 'Bundle', abbreviation: 'bdl', category: 'Quantity', isDefault: false },
    { name: 'Set', abbreviation: 'set', category: 'Quantity', isDefault: false },
    { name: 'Pair', abbreviation: 'pair', category: 'Quantity', isDefault: false },

    // Time
    { name: 'Hour', abbreviation: 'hr', category: 'Time', isDefault: true },
    { name: 'Day', abbreviation: 'day', category: 'Time', isDefault: false },
    { name: 'Month', abbreviation: 'mo', category: 'Time', isDefault: false },
];


async function seedUnits() {
    console.log('🌱 Seeding default units...');

    for (const unit of defaultUnits) {
        try {
            const existingUnit = await prisma.unit.findFirst({
                where: {
                    abbreviation: unit.abbreviation,
                    workspaceId: null, // Only check for system units
                },
            });

            if (existingUnit) {
                await prisma.unit.update({
                    where: { id: existingUnit.id },
                    data: {
                        // Update existing units to mark as default
                        isDefault: true,
                        createdBy: null,
                        isActive: true,
                        name: unit.name,
                        category: unit.category,
                    },
                });
                console.log(`✅ Updated unit: ${unit.name} (${unit.abbreviation})`);
            } else {
                await prisma.unit.create({
                    data: {
                        ...unit,
                        createdBy: null, // System units have no creator
                        workspaceId: null,
                    },
                });
                console.log(`✅ Created unit: ${unit.name} (${unit.abbreviation})`);
            }
        } catch (error) {
            console.error(`❌ Error creating unit ${unit.name}:`, error);
        }
    }

    const count = await prisma.unit.count();
    console.log(`\n✨ Total units in database: ${count}`);
}

async function main() {
    try {
        await seedUnits();
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
