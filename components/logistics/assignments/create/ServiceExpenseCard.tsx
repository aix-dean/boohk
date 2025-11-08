import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';

interface ServiceExpense {
  name: string;
  amount: string;
}

interface ServiceExpenseCardProps {
  expenses: ServiceExpense[];
  addExpense: () => void;
  removeExpense: (index: number) => void;
  updateExpense: (index: number, field: "name" | "amount", value: string) => void;
  calculateTotal: () => number;
}

export function ServiceExpenseCard({
  expenses,
  addExpense,
  removeExpense,
  updateExpense,
  calculateTotal,
}: ServiceExpenseCardProps) {
  return (
    <Card className="w-full" style={{ borderRadius: '20px', background: '#FFF', boxShadow: '-2px 4px 10.5px -2px rgba(0, 0, 0, 0.25)' }}>
      <CardHeader>
        <CardTitle style={{ color: '#000', fontFamily: 'Inter', fontSize: '16px', fontStyle: 'normal', lineHeight: '100%' }}>
          <div style={{ fontWeight: 600 }}>Service Expense</div>
          <div style={{ fontWeight: 400, fontSize: '14px', marginTop: '4px' }}>(Optional)</div>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {expenses.map((expense, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="Expense name"
                value={expense.name}
                onChange={(e) => updateExpense(index, "name", e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Amount"
                value={expense.amount}
                onChange={(e) => updateExpense(index, "amount", e.target.value)}
                className="w-32"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => removeExpense(index)}>X</Button>
          </div>
        ))}

        <Button variant="outline" className="w-full" onClick={addExpense}>+ Add Expense</Button>

        {calculateTotal() > 0 && (
          <div className="flex justify-between items-center mt-4">
            <span className="text-lg font-bold">Total: P {calculateTotal().toFixed(2)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
