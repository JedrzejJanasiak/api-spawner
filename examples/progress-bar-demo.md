# Progress Bar Demo

The API Spawner CLI now includes visual progress bars for better user experience during long-running operations.

## Progress Bar Features

### 1. Bulk Create Progress
When creating multiple API Gateways, you'll see a progress bar like this:

```
Creating API Gateways (Parallel) |████████████████████████████████████████| 100% | 50/50 | ETA: 0s | Created 50 API Gateways successfully
```

Or for sequential operations:

```
Creating API Gateways (Sequential) |████████████████████████████████████████| 100% | 50/50 | ETA: 0s | Created 50 API Gateways successfully
```

### 2. Bulk Delete Progress
When deleting multiple API Gateways:

```
Deleting API Gateways (Parallel) |████████████████████████████████████████| 100% | 25/25 | ETA: 0s | Deleted 25 API Gateways successfully
```

### 3. List Progress
When listing API Gateways across multiple regions:

```
Fetching API Gateways |████████████████████████████████████████| 100% | 24/24 | ETA: 0s | Found 15 API Gateways
```

## Progress Bar Information

The progress bars show:
- **Title**: Operation being performed
- **Progress Bar**: Visual representation of completion
- **Percentage**: Exact completion percentage
- **Current/Total**: Items processed vs total items
- **ETA**: Estimated time remaining
- **Status**: Current operation status or completion message

## Real-time Updates

Progress bars update in real-time showing:
- Current operation being performed
- Success/failure status for each item
- Overall completion progress
- Final summary

## Benefits

- **Better UX**: Users can see exactly what's happening
- **Time Estimation**: Know how long operations will take
- **Status Tracking**: See which items succeed or fail
- **Visual Feedback**: Clear indication of progress
- **Non-blocking**: Operations continue while showing progress

## Example Usage

```bash
# Create 100 API Gateways with progress bar
api-spawner bulk-create --name "demo-api" --total-gateways 100 --parallel

# Delete API Gateways with progress bar
api-spawner bulk-delete --pattern "demo-api-*" --parallel

# List all API Gateways with progress bar
api-spawner list
```

The progress bars automatically appear for operations involving multiple items and provide a much better user experience compared to simple spinners. 