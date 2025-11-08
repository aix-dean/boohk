import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

interface ServiceExpense {
  name: string;
  amount: string;
}

interface ServiceExpenseViewCardProps {
  expenses: ServiceExpense[];
}

export function ServiceExpenseViewCard({
  expenses,
}: ServiceExpenseViewCardProps) {
  const calculateTotal = () => {
    return expenses.reduce((sum, expense) => sum + (Number.parseFloat(expense.amount) || 0), 0);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>SERVICE EXPENSE</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {expenses.length === 0 ? (
          <p className="text-gray-500">No expenses recorded</p>
        ) : (
          <>
            {expenses.map((expense, index) => (
              <div key={index} className="flex items-center space-x-2">
                <div className="flex flex-1 gap-2">
                  <div className="flex-1 p-2 bg-gray-50 rounded border">
                    {expense.name || "N/A"}
                  </div>
                  <div className="w-32 p-2 bg-gray-50 rounded border text-right">
                    P {Number.parseFloat(expense.amount || "0").toFixed(2)}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-between items-center mt-4 pt-4 border-t">
              <span className="text-lg font-bold">Total: P {calculateTotal().toFixed(2)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}